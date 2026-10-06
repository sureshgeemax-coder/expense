import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import XLSX from 'xlsx';
import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = process.env.EXPENSEPRO_DATA_DIR || (process.env.VERCEL
  ? path.join(os.tmpdir(), 'expensepro-data')
  : path.join(__dirname, 'data'));
const dbPath = path.join(dataDir, 'expensepro.sqlite');
const upload = multer({ storage: multer.memoryStorage() });

const categoriesSeed = [
  { name: 'Breakfast', description: 'Morning food and snacks', icon: '☀️' },
  { name: 'Lunch', description: 'Midday meals', icon: '🍱' },
  { name: 'Dinner', description: 'Evening meals', icon: '🍽️' },
  { name: 'Drinks', description: 'Beverages and refreshments', icon: '🥤' },
  { name: 'Snacks / Food', description: 'Quick snacks and food items', icon: '🥨' },
  { name: 'Coffee / Tea', description: 'Coffee and tea purchases', icon: '☕' },
  { name: 'Groceries', description: 'Household groceries', icon: '🛒' },
  { name: 'Transport', description: 'Transport, commuting and travel', icon: '🚇' },
  { name: 'Shopping', description: 'General shopping', icon: '🛍️' },
  { name: 'Entertainment', description: 'Leisure and entertainment', icon: '🎬' },
  { name: 'Medical', description: 'Healthcare and pharmacy', icon: '💊' },
  { name: 'Bills', description: 'Utilities and recurring bills', icon: '🧾' },
  { name: 'Hotel', description: 'Accommodation and lodging', icon: '🏨' },
  { name: 'Travel', description: 'Trips and travel expenses', icon: '✈️' },
  { name: 'Fuel', description: 'Vehicle fuel', icon: '⛽' },
  { name: 'Parking', description: 'Parking sessions', icon: '🅿️' },
  { name: 'Education', description: 'Courses and learning', icon: '📚' },
  { name: 'Subscription', description: 'Recurring subscriptions', icon: '📡' },
  { name: 'Other', description: 'Miscellaneous expenses', icon: '📌' }
];

const currencySeed = [
  { code: 'SGD', name: 'Singapore Dollar', exchange_rate: 1 },
  { code: 'INR', name: 'Indian Rupee', exchange_rate: 0.015 },
  { code: 'USD', name: 'US Dollar', exchange_rate: 1.32 },
  { code: 'MYR', name: 'Malaysian Ringgit', exchange_rate: 0.29 },
  { code: 'EUR', name: 'Euro', exchange_rate: 1.56 },
  { code: 'GBP', name: 'British Pound', exchange_rate: 1.82 },
  { code: 'JPY', name: 'Japanese Yen', exchange_rate: 0.009 },
  { code: 'AUD', name: 'Australian Dollar', exchange_rate: 0.89 },
  { code: 'AED', name: 'UAE Dirham', exchange_rate: 0.36 }
];

const supportedCurrencies = currencySeed.map(item => item.code);
const currencyRates = Object.fromEntries(currencySeed.map(item => [item.code, Number(item.exchange_rate)]));

const app = express();
const configuredOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const vercelOrigins = [
  process.env.VERCEL_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
].filter(Boolean).map((host) => `https://${host}`);
const allowedOrigins = new Set([...configuredOrigins, ...vercelOrigins]);
app.use(cors({
  origin: (origin, callback) => {
    return callback(null, !origin || allowedOrigins.has(origin));
  },
  credentials: true
}));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ success: false, message: 'Origin not allowed' });
  }
  return next();
});

const SQL = await initSqlJs({
  locateFile: file => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
});

fs.mkdirSync(dataDir, { recursive: true });

const db = fs.existsSync(dbPath)
  ? new SQL.Database(new Uint8Array(fs.readFileSync(dbPath)))
  : new SQL.Database();

const formatSqlValue = (value) => {
  if (value === null || typeof value === 'undefined') return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
};

const interpolateSql = (sql, params = []) => {
  if (!params.length) return sql;
  let index = 0;
  return sql.replace(/\?/g, () => formatSqlValue(params[index++]));
};

const run = (sql, params = []) => {
  db.run(interpolateSql(sql, params));
};

const query = (sql, params = []) => {
  const results = db.exec(interpolateSql(sql, params));
  if (!results.length) return [];
  const columns = results[0].columns;
  return results[0].values.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
};

const saveDatabase = () => {
  const binary = Buffer.from(db.export());
  fs.writeFileSync(dbPath, binary);
};

const usersWorkbookPath = path.join(dataDir, 'users.xlsx');
const userWorkbookHeaders = ['User ID', 'Full Name', 'Email', 'Password', 'Created Date', 'Status'];
const sessionCookieName = 'expensepro_session';
const sessionSecret = process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? null : randomBytes(32).toString('hex'));
const sessionDurationSeconds = 60 * 60 * 24 * 30;

const hasValidSessionSecret = process.env.NODE_ENV !== 'production' ||
  (typeof sessionSecret === 'string' && sessionSecret.length >= 32);

const requireSessionSecret = (_req, res, next) => {
  if (!hasValidSessionSecret) {
    return res.status(503).json({
      success: false,
      message: 'Authentication is not configured. Set JWT_SECRET to a private value of at least 32 characters in the Vercel Production environment, then redeploy.'
    });
  }
  return next();
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};

const verifyPassword = (password, storedPassword) => {
  const [algorithm, salt, storedHash] = String(storedPassword || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !storedHash) {
    return { valid: String(storedPassword) === password, needsRehash: true };
  }

  const actualHash = scryptSync(password, salt, 64);
  const expectedHash = Buffer.from(storedHash, 'hex');
  return {
    valid: expectedHash.length === actualHash.length && timingSafeEqual(actualHash, expectedHash),
    needsRehash: false
  };
};

const signSession = (payload) => createHmac('sha256', sessionSecret).update(payload).digest('hex');
const createSessionToken = (user) => {
  const payload = Buffer.from(JSON.stringify({
    user,
    expiresAt: Date.now() + sessionDurationSeconds * 1000
  })).toString('base64url');
  return `${payload}.${signSession(payload)}`;
};

const readSessionUser = (req) => {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));
  if (!cookie) return null;

  const token = cookie.slice(sessionCookieName.length + 1);
  const separator = token.lastIndexOf('.');
  if (separator < 1) return null;

  const payload = token.slice(0, separator);
  const signature = Buffer.from(token.slice(separator + 1), 'hex');
  const expectedSignature = Buffer.from(signSession(payload), 'hex');
  if (signature.length !== expectedSignature.length || !timingSafeEqual(signature, expectedSignature)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.expiresAt > Date.now() ? session.user : null;
  } catch {
    return null;
  }
};

const setSessionCookie = (res, user, remember) => {
  const attributes = [
    `${sessionCookieName}=${createSessionToken(user)}`,
    'HttpOnly',
    `SameSite=${process.env.NODE_ENV === 'production' ? 'None' : 'Lax'}`,
    'Path=/'
  ];
  if (remember) attributes.push(`Max-Age=${sessionDurationSeconds}`);
  if (process.env.NODE_ENV === 'production') attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
};

const clearSessionCookie = (res) => {
  const attributes = [
    `${sessionCookieName}=`,
    'HttpOnly',
    `SameSite=${process.env.NODE_ENV === 'production' ? 'None' : 'Lax'}`,
    'Path=/',
    'Max-Age=0'
  ];
  if (process.env.NODE_ENV === 'production') attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
};

const requireAuthentication = (req, res, next) => {
  const user = readSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  req.authUser = user;
  return next();
};

const ensureUsersWorkbook = () => {
  fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(usersWorkbookPath)) {
    return;
  }

  const demoUser = {
    'User ID': 1,
    'Full Name': 'Demo User',
    Email: 'demo@expensepro.app',
    Password: hashPassword('demo1234'),
    'Created Date': new Date().toISOString(),
    Status: 'Active'
  };

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([demoUser], { header: userWorkbookHeaders });
  XLSX.utils.book_append_sheet(workbook, sheet, 'Users');
  XLSX.writeFile(workbook, usersWorkbookPath);
};

const readUsersFromWorkbook = () => {
  ensureUsersWorkbook();

  const workbook = XLSX.readFile(usersWorkbookPath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  return rows.map((row) => ({
    'User ID': row['User ID'] || row['UserID'] || '',
    'Full Name': row['Full Name'] || row['FullName'] || '',
    Email: row.Email || row.email || '',
    Password: row.Password || row.password || '',
    'Created Date': row['Created Date'] || row['createdDate'] || '',
    Status: row.Status || row.status || 'Active'
  }));
};

const writeUsersToWorkbook = (users) => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(users, { header: userWorkbookHeaders });
  XLSX.utils.book_append_sheet(workbook, sheet, 'Users');
  XLSX.writeFile(workbook, usersWorkbookPath);
};

const ensureSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      description TEXT,
      icon TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT,
      exchange_rate REAL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      expense_date TEXT,
      expense_time TEXT,
      transport_amount REAL DEFAULT 0,
      transport_currency TEXT DEFAULT 'SGD',
      total_sgd REAL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS expense_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER,
      category_id INTEGER,
      description TEXT,
      amount REAL,
      currency TEXT,
      exchange_rate REAL,
      sgd_amount REAL,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      month TEXT,
      year INTEGER,
      amount REAL,
      currency TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  if (!query(`SELECT COUNT(*) AS count FROM users`).length || Number(query(`SELECT COUNT(*) AS count FROM users`)[0].count) === 0) {
    run(`INSERT INTO users (name, email, created_at, updated_at) VALUES (?, ?, ?, ?)`, ['Demo User', 'demo@expensepro.app', new Date().toISOString(), new Date().toISOString()]);
  }

  ensureUsersWorkbook();

  if (query(`SELECT COUNT(*) AS count FROM categories`).length === 0) {
    categoriesSeed.forEach((category) => {
      run(`INSERT INTO categories (name, description, icon, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, [
        category.name,
        category.description,
        category.icon,
        1,
        new Date().toISOString(),
        new Date().toISOString()
      ]);
    });
  }

  if (query(`SELECT COUNT(*) AS count FROM currencies`).length === 0) {
    currencySeed.forEach((currency) => {
      run(`INSERT INTO currencies (code, name, exchange_rate, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, [
        currency.code,
        currency.name,
        currency.exchange_rate,
        1,
        new Date().toISOString(),
        new Date().toISOString()
      ]);
    });
  }
};

const rateForCurrency = (currencyCode) => {
  const normalized = (currencyCode || 'SGD').toUpperCase();
  return currencyRates[normalized] ?? 1;
};

const convertToSgd = (amount, currencyCode) => {
  const numericAmount = Number(amount || 0);
  return Number((numericAmount * rateForCurrency(currencyCode)).toFixed(2));
};

const getCategoryIdByName = (name) => {
  const match = query(`SELECT id FROM categories WHERE name = ? LIMIT 1`, [name]);
  if (match.length) {
    return Number(match[0].id);
  }

  const createdAt = new Date().toISOString();
  run(`INSERT INTO categories (name, description, icon, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, [
    name,
    'Custom category',
    '📌',
    1,
    createdAt,
    createdAt
  ]);

  return Number(query(`SELECT id FROM categories WHERE name = ? LIMIT 1`, [name])[0].id);
};

const getCategoryNameById = (categoryId) => {
  const match = query(`SELECT name FROM categories WHERE id = ? LIMIT 1`, [categoryId]);
  return match[0] ? match[0].name : 'Other';
};

const getCurrencyRate = (code) => {
  const result = query(`SELECT exchange_rate FROM currencies WHERE code = ? LIMIT 1`, [code]);
  if (result.length) {
    return Number(result[0].exchange_rate);
  }
  return rateForCurrency(code);
};

const getDefaultExpensePayload = (row) => {
  const categoryName = row.category || 'Other';
  const description = row.description || categoryName;
  const amount = Number(row.amount || 0);
  const currency = (row.currency || 'SGD').toUpperCase();
  const notes = row.notes || '';

  return {
    category: categoryName,
    description,
    amount,
    currency,
    notes,
    exchangeRate: getCurrencyRate(currency),
    sgdAmount: Number((amount * getCurrencyRate(currency)).toFixed(2))
  };
};

const serializeExpense = (row) => {
  const items = query(`SELECT ei.*, c.name as category_name FROM expense_items ei LEFT JOIN categories c ON c.id = ei.category_id WHERE ei.expense_id = ? ORDER BY ei.id ASC`, [row.id]);
  return {
    id: row.id,
    expenseDate: row.expense_date,
    expenseTime: row.expense_time,
    transportAmount: Number(row.transport_amount || 0),
    transportCurrency: row.transport_currency || 'SGD',
    totalSgd: Number(row.total_sgd || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map(item => ({
      id: item.id,
      category: item.category_name || getCategoryNameById(item.category_id),
      categoryId: item.category_id,
      description: item.description,
      amount: Number(item.amount || 0),
      currency: item.currency,
      exchangeRate: Number(item.exchange_rate || 1),
      sgdAmount: Number(item.sgd_amount || 0),
      notes: item.notes
    }))
  };
};

const calculateExpenseTotal = (transportAmount, transportCurrency, items) => {
  const transportSgd = convertToSgd(transportAmount, transportCurrency);
  const itemTotal = items.reduce((sum, item) => {
    return sum + convertToSgd(item.amount, item.currency || 'SGD');
  }, 0);
  return Number((transportSgd + itemTotal).toFixed(2));
};

const upsertExpense = (payload, existingId = null) => {
  const expenseDate = payload.expenseDate || new Date().toISOString().slice(0, 10);
  const expenseTime = payload.expenseTime || new Date().toTimeString().slice(0, 5);
  const transportAmount = Number(payload.transportAmount || 0);
  const transportCurrency = (payload.transportCurrency || 'SGD').toUpperCase();
  const items = Array.isArray(payload.items) ? payload.items : [];

  const sanitizedItems = items.map((item) => {
    const itemAmount = Number(item.amount || 0);
    const itemCurrency = (item.currency || 'SGD').toUpperCase();
    const rate = getCurrencyRate(itemCurrency);
    return {
      category: item.category || 'Other',
      description: item.description || 'Expense item',
      amount: Number(itemAmount.toFixed(2)),
      currency: itemCurrency,
      exchangeRate: Number(rate.toFixed(6)),
      sgdAmount: Number((itemAmount * rate).toFixed(2)),
      notes: item.notes || ''
    };
  });

  const totalSgd = calculateExpenseTotal(transportAmount, transportCurrency, sanitizedItems);

  if (existingId) {
    run(`DELETE FROM expense_items WHERE expense_id = ?`, [existingId]);
    run(`UPDATE expenses SET expense_date = ?, expense_time = ?, transport_amount = ?, transport_currency = ?, total_sgd = ?, updated_at = ? WHERE id = ?`, [
      expenseDate,
      expenseTime,
      Number(transportAmount.toFixed(2)),
      transportCurrency,
      Number(totalSgd.toFixed(2)),
      new Date().toISOString(),
      existingId
    ]);

    const now = new Date().toISOString();
    sanitizedItems.forEach((item) => {
      const categoryId = getCategoryIdByName(item.category);
      run(`INSERT INTO expense_items (expense_id, category_id, description, amount, currency, exchange_rate, sgd_amount, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        existingId,
        categoryId,
        item.description,
        item.amount,
        item.currency,
        item.exchangeRate,
        item.sgdAmount,
        item.notes,
        now,
        now
      ]);
    });

    return serializeExpense(query(`SELECT * FROM expenses WHERE id = ? LIMIT 1`, [existingId])[0]);
  }

  const now = new Date().toISOString();
  run(`INSERT INTO expenses (user_id, expense_date, expense_time, transport_amount, transport_currency, total_sgd, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    1,
    expenseDate,
    expenseTime,
    Number(transportAmount.toFixed(2)),
    transportCurrency,
    Number(totalSgd.toFixed(2)),
    now,
    now
  ]);

  const result = query(`SELECT id FROM expenses ORDER BY id DESC LIMIT 1`);
  const insertedId = Number(result[0].id);

  sanitizedItems.forEach((item) => {
    const categoryId = getCategoryIdByName(item.category);
    run(`INSERT INTO expense_items (expense_id, category_id, description, amount, currency, exchange_rate, sgd_amount, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      insertedId,
      categoryId,
      item.description,
      item.amount,
      item.currency,
      item.exchangeRate,
      item.sgdAmount,
      item.notes,
      now,
      now
    ]);
  });

  const created = query(`SELECT * FROM expenses WHERE id = ? LIMIT 1`, [insertedId]);
  return serializeExpense(created[0]);
};

const buildSummary = () => {
  const allExpenses = query(`SELECT * FROM expenses ORDER BY expense_date DESC`);
  const totals = allExpenses.reduce((acc, item) => {
    acc.total += Number(item.total_sgd || 0);
    return acc;
  }, { total: 0 });

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const getPeriodTotal = (start, end, inclusive = true) => allExpenses
    .filter((expense) => {
      const expenseDate = new Date(expense.expense_date + 'T00:00:00');
      return inclusive
        ? expenseDate >= start && expenseDate <= end
        : expenseDate >= start && expenseDate < end;
    })
    .reduce((sum, expense) => sum + Number(expense.total_sgd || 0), 0);

  const todayTotal = getPeriodTotal(new Date(todayKey + 'T00:00:00'), new Date(todayKey + 'T23:59:59'));
  const weekTotal = getPeriodTotal(weekStart, new Date(today), false);
  const monthTotal = getPeriodTotal(monthStart, new Date(today), false);
  const yearTotal = getPeriodTotal(yearStart, new Date(today), false);

  const transportOverall = query(`SELECT SUM(ei.sgd_amount) AS total FROM expense_items ei LEFT JOIN categories c ON c.id = ei.category_id WHERE c.name = 'Transport'`)[0]?.total || 0;
  const foodOverall = query(`SELECT SUM(ei.sgd_amount) AS total FROM expense_items ei LEFT JOIN categories c ON c.id = ei.category_id WHERE c.name IN ('Breakfast','Lunch','Dinner','Drinks','Snacks / Food','Coffee / Tea','Groceries')`)[0]?.total || 0;
  const otherOverall = Math.max(0, Number(monthTotal) - Number(foodOverall) - Number(transportOverall));

  const allItems = query(`SELECT ei.*, c.name AS category_name FROM expense_items ei LEFT JOIN categories c ON c.id = ei.category_id`);
  const highest = allExpenses.reduce((current, expense) => Math.max(current, Number(expense.total_sgd || 0)), 0);
  const transactions = allItems.length;
  const averageDaily = allExpenses.length ? Number((totals.total / Math.max(1, allExpenses.length)).toFixed(2)) : 0;

  return {
    period: {
      todayTotal: Number(todayTotal.toFixed(2)),
      weekTotal: Number(weekTotal.toFixed(2)),
      monthTotal: Number(monthTotal.toFixed(2)),
      yearTotal: Number(yearTotal.toFixed(2)),
      transportTotal: Number(transportOverall.toFixed(2)),
      foodTotal: Number(foodOverall.toFixed(2)),
      otherTotal: Number(otherOverall.toFixed(2)),
      totalTransactions: transactions,
      highestExpense: Number(highest.toFixed(2)),
      averageDailyExpense: Number(averageDaily.toFixed(2))
    },
    charts: {
      trend: buildTrendData(),
      categoryBreakdown: buildCategoryBreakdown(),
      monthlySpend: buildMonthlySpend(),
      transportVsOther: {
        transport: Number(transportOverall.toFixed(2)),
        other: Number(otherOverall.toFixed(2))
      },
      currencyBreakdown: buildCurrencyBreakdown()
    }
  };
};

const getPeriodDateRangeMap = (period) => {
  const end = new Date();
  const start = new Date();

  if (period === 'daily') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (period === 'weekly') {
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }

  if (period === 'monthly') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  if (period === 'yearly') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
};

const buildTrendData = () => {
  const recent = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const total = query(`SELECT COALESCE(SUM(total_sgd), 0) AS total FROM expenses WHERE expense_date = ?`, [key])[0]?.total || 0;
    recent.push({ date: key, total: Number(total) });
  }
  return recent;
};

const buildCategoryBreakdown = () => {
  const rows = query(`SELECT c.name, SUM(ei.sgd_amount) AS total FROM expense_items ei LEFT JOIN categories c ON c.id = ei.category_id GROUP BY c.name ORDER BY total DESC`);
  return rows.map((row) => ({ name: row.name || 'Other', total: Number(row.total || 0) }));
};

const buildMonthlySpend = () => {
  const rows = [];
  for (let month = 0; month < 6; month += 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - month);
    const monthKey = date.toISOString().slice(0, 7);
    const total = query(`SELECT COALESCE(SUM(total_sgd), 0) AS total FROM expenses WHERE substr(expense_date, 1, 7) = ?`, [monthKey])[0]?.total || 0;
    rows.unshift({ month: date.toLocaleDateString('en-US', { month: 'short' }), total: Number(total) });
  }
  return rows;
};

const buildCurrencyBreakdown = () => {
  const rows = query(`SELECT ei.currency, SUM(ei.sgd_amount) AS total FROM expense_items ei GROUP BY ei.currency ORDER BY total DESC`);
  return rows.map((row) => ({ currency: row.currency || 'SGD', total: Number(row.total || 0) }));
};

const getBudgetSummary = () => {
  const budgets = query(`SELECT b.id, b.month, b.year, b.amount, b.currency, c.name AS category_name FROM budgets b LEFT JOIN categories c ON c.id = b.category_id ORDER BY b.year DESC, b.month DESC`);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthKey = currentMonth.split('-');
  const year = Number(monthKey[0]);
  const month = Number(monthKey[1]);

  const filtered = budgets.filter((budget) => Number(budget.year) === year && Number(budget.month) === month);

  return filtered.map((budget) => {
    const categoryName = budget.category_name || 'Other';
    const spent = query(`SELECT COALESCE(SUM(ei.sgd_amount),0) AS total FROM expense_items ei LEFT JOIN categories c ON c.id = ei.category_id LEFT JOIN expenses e ON e.id = ei.expense_id WHERE c.name = ? AND substr(e.expense_date, 1, 7) = ?`, [categoryName, currentMonth])[0]?.total || 0;
    return {
      id: budget.id,
      month: budget.month,
      year: budget.year,
      category: categoryName,
      budgetAmount: Number(budget.amount || 0),
      spent: Number(spent),
      remaining: Number((Number(budget.amount || 0) - spent).toFixed(2)),
      percent: Number(budget.amount ? ((spent / Number(budget.amount)) * 100).toFixed(2) : 0),
      currency: budget.currency || 'SGD'
    };
  });
};

const normalizeExpenseQuery = (rows) => rows.map((row) => serializeExpense(row));

const random = (min, max) => Math.random() * (max - min) + min;
const createDemoData = () => {
  const now = new Date();
  const sampleExpenses = [
    {
      expenseDate: new Date(now.getFullYear(), now.getMonth(), 5).toISOString().slice(0, 10),
      expenseTime: '08:30',
      transportAmount: 5.0,
      transportCurrency: 'SGD',
      items: [
        { category: 'Lunch', description: 'Chicken rice', amount: 8.5, currency: 'SGD' },
        { category: 'Coffee / Tea', description: 'Coffee', amount: 3.5, currency: 'SGD' },
        { category: 'Snacks / Food', description: 'Milk tea and snacks', amount: 6.0, currency: 'SGD' },
        { category: 'Dinner', description: 'Noodles', amount: 15.0, currency: 'SGD' }
      ]
    },
    {
      expenseDate: new Date(now.getFullYear(), now.getMonth(), 7).toISOString().slice(0, 10),
      expenseTime: '10:15',
      transportAmount: 12.0,
      transportCurrency: 'SGD',
      items: [
        { category: 'Groceries', description: 'Weekly groceries', amount: 42.5, currency: 'SGD' },
        { category: 'Transport', description: 'Train fare', amount: 12.0, currency: 'SGD' }
      ]
    },
    {
      expenseDate: new Date(now.getFullYear(), now.getMonth(), 10).toISOString().slice(0, 10),
      expenseTime: '18:40',
      transportAmount: 0,
      transportCurrency: 'SGD',
      items: [
        { category: 'Shopping', description: 'Office supplies', amount: 29.0, currency: 'SGD' },
        { category: 'Dinner', description: 'Seafood dinner', amount: 34.5, currency: 'SGD' },
        { category: 'Drinks', description: 'Sparkling water', amount: 4.5, currency: 'SGD' }
      ]
    },
    {
      expenseDate: new Date(now.getFullYear(), now.getMonth(), 15).toISOString().slice(0, 10),
      expenseTime: '07:05',
      transportAmount: 18.0,
      transportCurrency: 'SGD',
      items: [
        { category: 'Breakfast', description: 'Sandwich and coffee', amount: 12.5, currency: 'SGD' },
        { category: 'Transport', description: 'Taxi to station', amount: 18.0, currency: 'SGD' },
        { category: 'Bills', description: 'Internet bill', amount: 42.0, currency: 'SGD' }
      ]
    },
    {
      expenseDate: new Date(now.getFullYear(), now.getMonth(), 22).toISOString().slice(0, 10),
      expenseTime: '12:30',
      transportAmount: 8.5,
      transportCurrency: 'SGD',
      items: [
        { category: 'Lunch', description: 'Salad bowl', amount: 11.0, currency: 'SGD' },
        { category: 'Entertainment', description: 'Movie tickets', amount: 24.0, currency: 'SGD' },
        { category: 'Travel', description: 'Weekend trip', amount: 110.0, currency: 'SGD' }
      ]
    }
  ];

  sampleExpenses.forEach((sample) => upsertExpense(sample));

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const budgetRows = [
    { category: 'Breakfast', month: currentMonth, year: currentYear, amount: 180 },
    { category: 'Lunch', month: currentMonth, year: currentYear, amount: 260 },
    { category: 'Dinner', month: currentMonth, year: currentYear, amount: 300 },
    { category: 'Transport', month: currentMonth, year: currentYear, amount: 240 },
    { category: 'Shopping', month: currentMonth, year: currentYear, amount: 220 }
  ];

  budgetRows.forEach((row) => {
    const categoryId = getCategoryIdByName(row.category);
    run(`INSERT INTO budgets (category_id, month, year, amount, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      categoryId,
      row.month,
      row.year,
      row.amount,
      'SGD',
      new Date().toISOString(),
      new Date().toISOString()
    ]);
  });
};

ensureSchema();
if (query(`SELECT COUNT(*) AS count FROM expenses`).length === 0) {
  createDemoData();
}

saveDatabase();

app.post('/api/auth/signup', (req, res) => {
  const { fullName, email, password, confirmPassword } = req.body || {};

  if (typeof fullName !== 'string' || !fullName.trim() ||
      typeof email !== 'string' || !email.trim() ||
      typeof password !== 'string' || !password ||
      typeof confirmPassword !== 'string' || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
  }

  if (String(password) !== String(confirmPassword)) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }

  const users = readUsersFromWorkbook();
  const normalizedEmail = normalizeEmail(email);
  const existingUser = users.find((user) => normalizeEmail(user.Email) === normalizedEmail);

  if (existingUser) {
    return res.status(409).json({ success: false, message: 'Email already exists' });
  }

  const nextId = users.length ? Math.max(...users.map((user) => Number(user['User ID'] || 0))) + 1 : 1;
  const now = new Date().toISOString();
  const newUser = {
    'User ID': nextId,
    'Full Name': fullName.trim(),
    Email: normalizedEmail,
    Password: hashPassword(password),
    'Created Date': now,
    Status: 'Active'
  };

  users.push(newUser);
  writeUsersToWorkbook(users);

  return res.status(201).json({ success: true, message: 'Account created successfully' });
});

app.post('/api/auth/login', requireSessionSecret, (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const users = readUsersFromWorkbook();
  const match = users.find((user) => normalizeEmail(user.Email) === normalizeEmail(email));
  const passwordVerification = match?.Status === 'Active'
    ? verifyPassword(password, String(match.Password))
    : null;

  if (!match || !passwordVerification?.valid) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  if (passwordVerification.needsRehash) {
    match.Password = hashPassword(password);
    writeUsersToWorkbook(users);
  }

  const user = {
    id: match['User ID'],
    fullName: match['Full Name'],
    email: match.Email,
    status: match.Status || 'Active'
  };
  setSessionCookie(res, user, req.body.remember === true);

  return res.json({
    success: true,
    message: 'Login successful',
    data: { user }
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'ExpensePro API is healthy' });
});

app.get('/api/auth/session', requireSessionSecret, (req, res) => {
  const user = readSessionUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  return res.json({ success: true, data: { user } });
});

app.post('/api/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true, message: 'Signed out successfully' });
});

app.use('/api', requireSessionSecret, requireAuthentication);

app.get('/api/dashboard', (_req, res) => {
  try {
    res.json({ success: true, data: buildSummary(), message: 'Dashboard data loaded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to load dashboard', errors: [error.message] });
  }
});

app.get('/api/categories', (_req, res) => {
  const categories = query(`SELECT * FROM categories ORDER BY name ASC`);
  res.json({ success: true, data: categories, message: 'Categories loaded successfully' });
});

app.post('/api/categories', (req, res) => {
  const { name, description, icon } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required', errors: ['name'] });
  }

  const existing = query(`SELECT * FROM categories WHERE name = ? LIMIT 1`, [String(name).trim()]);
  if (existing.length) {
    return res.status(409).json({ success: false, message: 'Category already exists', errors: ['name'] });
  }

  const now = new Date().toISOString();
  run(`INSERT INTO categories (name, description, icon, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, [
    String(name).trim(),
    description || '',
    icon || '📌',
    1,
    now,
    now
  ]);
  saveDatabase();
  res.status(201).json({ success: true, message: 'Category created successfully' });
});

app.put('/api/categories/:id', (req, res) => {
  const { name, description, icon } = req.body || {};
  run(`UPDATE categories SET name = ?, description = ?, icon = ?, updated_at = ? WHERE id = ?`, [
    String(name || '').trim(),
    description || '',
    icon || '📌',
    new Date().toISOString(),
    Number(req.params.id)
  ]);
  saveDatabase();
  res.json({ success: true, message: 'Category updated successfully' });
});

app.delete('/api/categories/:id', (req, res) => {
  const row = query(`SELECT id FROM expense_items WHERE category_id = ? LIMIT 1`, [Number(req.params.id)]);
  if (row.length) {
    return res.status(400).json({ success: false, message: 'Category is actively used by expenses', errors: ['in_use'] });
  }

  run(`DELETE FROM categories WHERE id = ?`, [Number(req.params.id)]);
  saveDatabase();
  res.json({ success: true, message: 'Category deleted successfully' });
});

app.get('/api/currencies', (_req, res) => {
  const currencies = query(`SELECT * FROM currencies ORDER BY code ASC`);
  res.json({ success: true, data: currencies, message: 'Currencies loaded successfully' });
});

app.post('/api/currencies', (req, res) => {
  const { code, name, exchangeRate } = req.body || {};
  if (!code || !name || !exchangeRate) {
    return res.status(400).json({ success: false, message: 'Code, name and exchange rate are required', errors: ['code', 'name', 'exchangeRate'] });
  }

  const now = new Date().toISOString();
  run(`INSERT INTO currencies (code, name, exchange_rate, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, [
    String(code).toUpperCase(),
    name,
    Number(exchangeRate),
    1,
    now,
    now
  ]);
  saveDatabase();
  res.status(201).json({ success: true, message: 'Currency created successfully' });
});

app.put('/api/currencies/:id', (req, res) => {
  const { code, name, exchangeRate } = req.body || {};
  run(`UPDATE currencies SET code = ?, name = ?, exchange_rate = ?, updated_at = ? WHERE id = ?`, [
    String(code || '').toUpperCase(),
    name,
    Number(exchangeRate || 1),
    new Date().toISOString(),
    Number(req.params.id)
  ]);
  saveDatabase();
  res.json({ success: true, message: 'Currency updated successfully' });
});

app.delete('/api/currencies/:id', (req, res) => {
  run(`DELETE FROM currencies WHERE id = ?`, [Number(req.params.id)]);
  saveDatabase();
  res.json({ success: true, message: 'Currency deleted successfully' });
});

app.get('/api/budgets', (_req, res) => {
  res.json({ success: true, data: getBudgetSummary(), message: 'Budgets loaded successfully' });
});

app.post('/api/budgets', (req, res) => {
  const { category, month, year, amount, currency } = req.body || {};
  if (!category || !month || !year || !amount) {
    return res.status(400).json({ success: false, message: 'Budget category, month, year and amount are required', errors: ['category', 'month', 'year', 'amount'] });
  }

  const categoryId = getCategoryIdByName(category);
  const now = new Date().toISOString();
  run(`INSERT INTO budgets (category_id, month, year, amount, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    categoryId,
    Number(month),
    Number(year),
    Number(amount),
    (currency || 'SGD').toUpperCase(),
    now,
    now
  ]);
  saveDatabase();
  res.status(201).json({ success: true, message: 'Budget saved successfully' });
});

app.put('/api/budgets/:id', (req, res) => {
  const { category, month, year, amount, currency } = req.body || {};
  const categoryId = getCategoryIdByName(category);
  run(`UPDATE budgets SET category_id = ?, month = ?, year = ?, amount = ?, currency = ?, updated_at = ? WHERE id = ?`, [
    categoryId,
    Number(month),
    Number(year),
    Number(amount),
    (currency || 'SGD').toUpperCase(),
    new Date().toISOString(),
    Number(req.params.id)
  ]);
  saveDatabase();
  res.json({ success: true, message: 'Budget updated successfully' });
});

app.delete('/api/budgets/:id', (req, res) => {
  run(`DELETE FROM budgets WHERE id = ?`, [Number(req.params.id)]);
  saveDatabase();
  res.json({ success: true, message: 'Budget deleted successfully' });
});

app.get('/api/expenses', (req, res) => {
  const { search = '', category = '', currency = '', from = '', to = '', sortBy = 'expense_date', sortDir = 'desc', page = 1, limit = 20 } = req.query;
  const rows = query(`SELECT * FROM expenses ORDER BY expense_date DESC, id DESC`);
  const filtered = normalizeExpenseQuery(rows).filter((expense) => {
    const queryString = [expense.items.map((item) => item.description).join(' '), expense.items.map((item) => item.category).join(' ')].join(' ').toLowerCase();
    const matchesSearch = !search || queryString.includes(String(search).toLowerCase());
    const matchesCategory = !category || expense.items.some((item) => item.category === category);
    const matchesCurrency = !currency || expense.items.some((item) => item.currency === String(currency).toUpperCase()) || expense.transportCurrency === String(currency).toUpperCase();
    const matchesFrom = !from || expense.expenseDate >= String(from);
    const matchesTo = !to || expense.expenseDate <= String(to);
    return matchesSearch && matchesCategory && matchesCurrency && matchesFrom && matchesTo;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'amount') return dir * (Number(b.totalSgd || 0) - Number(a.totalSgd || 0));
    if (sortBy === 'category') return dir * (a.items[0]?.category || '').localeCompare(b.items[0]?.category || '');
    return dir * (new Date(b.expenseDate) - new Date(a.expenseDate));
  });

  const start = (Number(page) - 1) * Number(limit);
  const end = start + Number(limit);
  const paginated = sorted.slice(start, end);

  res.json({
    success: true,
    data: paginated,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: sorted.length,
      totalPages: Math.max(1, Math.ceil(sorted.length / Number(limit)))
    },
    message: 'Expenses loaded successfully'
  });
});

app.get('/api/expenses/:id', (req, res) => {
  const row = query(`SELECT * FROM expenses WHERE id = ? LIMIT 1`, [Number(req.params.id)]);
  if (!row.length) {
    return res.status(404).json({ success: false, message: 'Expense not found' });
  }
  res.json({ success: true, data: serializeExpense(row[0]), message: 'Expense detail loaded' });
});

app.post('/api/expenses', (req, res) => {
  const body = req.body || {};
  if (!body.expenseDate) {
    return res.status(400).json({ success: false, message: 'Expense date is required', errors: ['expenseDate'] });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one expense item is required', errors: ['items'] });
  }

  const isValid = body.items.every((item) => Number(item.amount || 0) > 0 && (item.category || '').trim());
  if (!isValid) {
    return res.status(400).json({ success: false, message: 'Every item must include a valid category and positive amount', errors: ['items'] });
  }

  try {
    const created = upsertExpense(body);
    saveDatabase();
    res.status(201).json({ success: true, data: created, message: 'Expense saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to save expense', errors: [error.message] });
  }
});

app.put('/api/expenses/:id', (req, res) => {
  const existing = query(`SELECT * FROM expenses WHERE id = ? LIMIT 1`, [Number(req.params.id)]);
  if (!existing.length) {
    return res.status(404).json({ success: false, message: 'Expense not found' });
  }

  const updated = upsertExpense(req.body, Number(req.params.id));
  saveDatabase();
  res.json({ success: true, data: updated, message: 'Expense updated successfully' });
});

app.delete('/api/expenses/:id', (req, res) => {
  run(`DELETE FROM expense_items WHERE expense_id = ?`, [Number(req.params.id)]);
  run(`DELETE FROM expenses WHERE id = ?`, [Number(req.params.id)]);
  saveDatabase();
  res.json({ success: true, message: 'Expense deleted successfully' });
});

app.get('/api/reports/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const rows = query(`SELECT * FROM expenses WHERE expense_date = ? ORDER BY expense_date DESC`, [date]);
  const expenseRows = rows.map((row) => serializeExpense(row));
  const totals = expenseRows.reduce((sum, item) => sum + Number(item.totalSgd || 0), 0);
  const transport = expenseRows.reduce((sum, item) => sum + Number(item.transportAmount || 0), 0);
  const byCategory = Object.entries(expenseRows.reduce((acc, expense) => {
    expense.items.forEach((item) => {
      const category = item.category;
      acc[category] = (acc[category] || 0) + Number(item.sgdAmount || 0);
    });
    return acc;
  }, {})).map(([name, total]) => ({ name, total: Number(total.toFixed(2)) }));

  res.json({
    success: true,
    data: {
      date,
      total,
      transport,
      categoryBreakdown: byCategory,
      transactions: expenseRows.length,
      average: expenseRows.length ? Number((totals / expenseRows.length).toFixed(2)) : 0,
      expenses: expenseRows
    },
    message: 'Daily report generated successfully'
  });
});

app.get('/api/reports/weekly', (req, res) => {
  const rows = query(`SELECT * FROM expenses WHERE expense_date >= date('now','-6 day') ORDER BY expense_date DESC`);
  const expenseRows = rows.map((row) => serializeExpense(row));
  const total = expenseRows.reduce((sum, item) => sum + Number(item.totalSgd || 0), 0);
  res.json({ success: true, data: { total, averageDaily: Number((total / 7).toFixed(2)), expenses: expenseRows }, message: 'Weekly report generated successfully' });
});

app.get('/api/reports/monthly', (req, res) => {
  const now = new Date();
  const month = String(req.query.month || now.getMonth() + 1).padStart(2, '0');
  const year = req.query.year || now.getFullYear();
  const rows = query(`SELECT * FROM expenses WHERE substr(expense_date, 1, 7) = ? ORDER BY expense_date DESC`, [`${year}-${month}`]);
  const expenseRows = rows.map((row) => serializeExpense(row));
  const total = expenseRows.reduce((sum, item) => sum + Number(item.totalSgd || 0), 0);
  res.json({ success: true, data: { total, averageDaily: Number((total / 30).toFixed(2)), expenses: expenseRows }, message: 'Monthly report generated successfully' });
});

app.get('/api/reports/yearly', (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  const rows = query(`SELECT * FROM expenses WHERE substr(expense_date, 1, 4) = ? ORDER BY expense_date DESC`, [String(year)]);
  const expenseRows = rows.map((row) => serializeExpense(row));
  const total = expenseRows.reduce((sum, item) => sum + Number(item.totalSgd || 0), 0);
  res.json({ success: true, data: { total, averageMonthly: Number((total / 12).toFixed(2)), expenses: expenseRows }, message: 'Yearly report generated successfully' });
});

app.post('/api/reports/email', (req, res) => {
  const { recipientEmail, subject, message, reportType, attachmentFormat } = req.body || {};
  if (!recipientEmail) {
    return res.status(400).json({ success: false, message: 'Recipient email is required', errors: ['recipientEmail'] });
  }

  res.json({
    success: true,
    data: {
      recipientEmail,
      subject: subject || 'ExpensePro Report',
      message: message || 'Attached report is ready.',
      reportType: reportType || 'monthly',
      attachmentFormat: attachmentFormat || 'PDF'
    },
    message: 'Email report queued successfully'
  });
});

app.post('/api/reports/share', (req, res) => {
  const { title = 'ExpensePro Monthly Report', period = 'Monthly' } = req.body || {};
  const summary = buildSummary();
  const message = `${title}\n${period}\nTotal: S$${summary.period.monthTotal.toFixed(2)}\nTransport: S$${summary.period.transportTotal.toFixed(2)}\nFood: S$${summary.period.foodTotal.toFixed(2)}\nOther: S$${summary.period.otherTotal.toFixed(2)}`;
  res.json({ success: true, data: { message, shareUrl: 'https://example.com/report' }, message: 'Share summary created successfully' });
});

app.post('/api/import/excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Excel file is required', errors: ['file'] });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const issues = [];
    const validRows = [];

    rows.forEach((row, index) => {
      const normalized = {
        date: row.date || row.Date || row.expenseDate || '',
        category: row.category || row.Category || 'Other',
        description: row.description || row.Description || 'Imported item',
        amount: row.amount || row.Amount || 0,
        currency: (row.currency || row.Currency || 'SGD').toUpperCase(),
        notes: row.notes || row.Notes || ''
      };

      if (!normalized.date || !normalized.category || Number(normalized.amount) <= 0 || !supportedCurrencies.includes(normalized.currency)) {
        issues.push({ row: index + 2, message: 'Invalid date, category, amount or currency' });
        return;
      }

      validRows.push({
        expenseDate: normalized.date,
        expenseTime: '09:00',
        transportAmount: 0,
        transportCurrency: normalized.currency,
        items: [{
          category: normalized.category,
          description: normalized.description,
          amount: Number(normalized.amount),
          currency: normalized.currency,
          notes: normalized.notes
        }]
      });
    });

    validRows.forEach((item) => upsertExpense(item));
    saveDatabase();

    res.json({
      success: true,
      data: {
        totalRows: rows.length,
        validRows: validRows.length,
        invalidRows: issues.length,
        warnings: issues,
        imported: validRows.length
      },
      message: 'Excel import completed successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid Excel file', errors: [error.message] });
  }
});

app.get('/api/export/excel', (_req, res) => {
  const expenses = query(`SELECT * FROM expenses ORDER BY expense_date DESC`);
  const rows = expenses.map((expense) => ({
    Date: expense.expense_date,
    Time: expense.expense_time,
    Transport: Number(expense.transport_amount || 0),
    Total: Number(expense.total_sgd || 0)
  }));

  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, summary, 'Transactions');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="expensepro-report.xlsx"');
  res.send(buffer);
});

app.get('/api/export/pdf', (_req, res) => {
  const summary = buildSummary();
  const doc = new PDFDocument({ margin: 50 });
  const fileName = 'expensepro-report.pdf';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  doc.pipe(res);
  doc.fontSize(20).text('ExpensePro Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Total Expense: S$${summary.period.monthTotal.toFixed(2)}`);
  doc.text(`Transport: S$${summary.period.transportTotal.toFixed(2)}`);
  doc.text(`Food: S$${summary.period.foodTotal.toFixed(2)}`);
  doc.text(`Other: S$${summary.period.otherTotal.toFixed(2)}`);
  doc.end();
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Something went wrong', errors: [err.message] });
});

export default app;

if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT || 4000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ExpensePro API listening on http://localhost:${PORT}`);
  });
}
