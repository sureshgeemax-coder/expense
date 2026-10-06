import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  ArrowUpRight,
  DollarSign,
  Eye,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  Palette,
  Plus,
  Receipt,
  Search,
  Settings,
  Sun,
  Wallet,
  TrendingUp,
  Menu,
  X,
  CalendarDays,
  Landmark,
  Tags,
  CreditCard,
  DownloadCloud,
  Gauge,
  RefreshCw,
  CircleDollarSign
} from 'lucide-react';

const apiBase = '/api';
const apiFetch = (resource, options = {}) =>
  fetch(`${apiBase}${resource}`, { ...options, credentials: 'include' });
const readApiResponse = async (response) => {
  const responseText = await response.text();

  try {
    return JSON.parse(responseText);
  } catch {
    if (response.status === 404) {
      throw new Error(
        'The API route returned 404. Check that Vercel deployed the latest commit, the project Root Directory is the repository root, and /api/* is routed to the Express function.'
      );
    }
    const isHtml = response.headers.get('content-type')?.includes('text/html') ||
      /^\s*</.test(responseText);
    if (isHtml) {
      throw new Error(
        `The API returned a web page instead of JSON (HTTP ${response.status}). ` +
        'Vercel did not route this request to the Express API. Confirm the latest deployment includes the api folder and that the Vercel Root Directory is the repository root.'
      );
    }
    throw new Error(`The API returned an invalid response (HTTP ${response.status}). Please try again.`);
  }
};
const defaultCategories = ['Breakfast', 'Lunch', 'Dinner', 'Drinks', 'Snacks / Food', 'Coffee / Tea', 'Groceries', 'Transport', 'Shopping', 'Entertainment', 'Medical', 'Bills', 'Hotel', 'Travel', 'Fuel', 'Parking', 'Education', 'Subscription', 'Other'];
const defaultCurrencies = ['SGD', 'INR', 'USD', 'MYR', 'EUR', 'GBP', 'JPY', 'AUD', 'AED'];

const formatCurrency = (value = 0, currency = 'SGD') =>
  new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: currency || 'SGD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const getRate = (currency) => {
  const rates = { SGD: 1, INR: 0.015, USD: 1.32, MYR: 0.29, EUR: 1.56, GBP: 1.82, JPY: 0.009, AUD: 0.89, AED: 0.36 };
  return rates[currency] || 1;
};

const buildItemPreview = (items = [], transportAmount = 0, transportCurrency = 'SGD') => {
  const itemTotal = items.reduce((sum, item) => sum + Number(item.amount || 0) * getRate(item.currency || 'SGD'), 0);
  const transportTotal = Number(transportAmount || 0) * getRate(transportCurrency || 'SGD');
  return Number((itemTotal + transportTotal).toFixed(2));
};

function AuthenticatedApp({ user, onLogout, toast, setToast }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('expensepro-theme') || 'system');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const resolveTheme = () => {
      const computed = theme === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = computed;
      localStorage.setItem('expensepro-theme', theme);
    };

    resolveTheme();
    mediaQuery.addEventListener('change', resolveTheme);
    return () => mediaQuery.removeEventListener('change', resolveTheme);
  }, [theme]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-box">
          <div className="brand-mark">E</div>
          <div>
            <h1>ExpensePro</h1>
            <p>Smart finances</p>
          </div>
          <button className="icon-button mobile-only" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list">
          <NavLink to="/dashboard" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/dashboard/add-expense" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Plus size={18} />
            <span>Add Expense</span>
          </NavLink>
          <NavLink to="/dashboard/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Receipt size={18} />
            <span>Expense History</span>
          </NavLink>
          <NavLink to="/dashboard/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={18} />
            <span>Reports</span>
          </NavLink>
          <NavLink to="/dashboard/budgets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Wallet size={18} />
            <span>Budgets</span>
          </NavLink>
          <NavLink to="/dashboard/categories" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Tags size={18} />
            <span>Categories</span>
          </NavLink>
          <NavLink to="/dashboard/currencies" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Landmark size={18} />
            <span>Currencies</span>
          </NavLink>
          <NavLink to="/dashboard/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="profile-box">
          <div className="avatar">{(user?.fullName || 'DK').split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase().slice(0, 2)}</div>
          <div>
            <strong>{user?.fullName || 'Demo User'}</strong>
            <span>Financial overview</span>
          </div>
          <button className="icon-button" type="button" aria-label="Logout" onClick={onLogout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-only" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={18} />
            </button>
            <div>
              <span className="eyebrow">Expense dashboard</span>
              <h2>ExpensePro</h2>
            </div>
          </div>

          <div className="topbar-actions">
            <button className="icon-button" type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button" type="button" onClick={() => setTheme('system')} aria-label="Use system theme">
              <Palette size={18} />
            </button>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/add-expense" element={<AddExpensePage setToast={setToast} />} />
          <Route path="/history" element={<HistoryPage setToast={setToast} />} />
          <Route path="/reports" element={<ReportsPage setToast={setToast} />} />
          <Route path="/budgets" element={<BudgetsPage setToast={setToast} />} />
          <Route path="/categories" element={<CategoriesPage setToast={setToast} />} />
          <Route path="/currencies" element={<CurrenciesPage setToast={setToast} />} />
          <Route path="/settings" element={<SettingsPage setToast={setToast} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function LoginPage({ onLoginSuccess, initialError }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.email.trim() || !form.password.trim()) {
      setError('Invalid email or password');
      return;
    }

    const email = form.email.trim();
    const password = form.password;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      setError('Invalid email or password');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember: form.remember })
      });
      const payload = await readApiResponse(response);

      if (!response.ok || !payload.success) {
        setError(payload.message || 'Invalid email or password');
        return;
      }

      onLoginSuccess(payload.data.user);
      navigate('/dashboard');
    } catch (error) {
      setError(error.message || 'Unable to connect to ExpensePro. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark large">E</div>
          <div>
            <span className="eyebrow light">Welcome back</span>
            <h1>ExpensePro</h1>
          </div>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="field-group">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" />
          </div>

          <div className="field-group">
            <label htmlFor="login-password">Password</label>
            <div className="password-wrap">
              <input id="login-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Enter your password" />
              <button type="button" className="link-button" onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="auth-row">
            <label className="check-row">
              <input type="checkbox" checked={form.remember} onChange={(event) => setForm({ ...form, remember: event.target.checked })} />
              <span>Remember Me</span>
            </label>
            <button type="button" className="link-button">Forgot Password</button>
          </div>

          {error || initialError ? <div className="auth-error">{error || initialError}</div> : null}

          <button type="submit" className="primary-button auth-submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </button>

          <div className="auth-footer">
            <span>Need an account?</span>
            <Link to="/signup" className="link-button accent">Create Account</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    if (!fullName || !email || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, confirmPassword })
      });
      const payload = await readApiResponse(response);

      if (!response.ok || !payload.success) {
        setError(payload.message || 'Unable to create account');
        return;
      }

      setSuccess('Account created successfully. Redirecting to login...');
      setTimeout(() => navigate('/'), 1200);
    } catch (error) {
      setError(error.message || 'Unable to connect to ExpensePro. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark large">E</div>
          <div>
            <span className="eyebrow light">Create account</span>
            <h1>ExpensePro</h1>
          </div>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="field-group">
            <label htmlFor="signup-name">Full Name</label>
            <input id="signup-name" type="text" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="John Doe" />
          </div>

          <div className="field-group">
            <label htmlFor="signup-email">Email</label>
            <input id="signup-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" />
          </div>

          <div className="field-group">
            <label htmlFor="signup-password">Password</label>
            <div className="password-wrap">
              <input id="signup-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Minimum 8 characters" />
              <button type="button" className="link-button" onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="signup-confirm-password">Confirm Password</label>
            <input id="signup-confirm-password" type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} placeholder="Confirm your password" />
          </div>

          {error ? <div className="auth-error">{error}</div> : null}
          {success ? <div className="auth-success">{success}</div> : null}

          <button type="submit" className="primary-button auth-submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <div className="auth-footer">
            <span>Already have an account?</span>
            <Link to="/" className="link-button accent">Back to Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const response = await apiFetch('/auth/session');
        if (response.status === 401) return;
        const payload = await readApiResponse(response);
        if (!response.ok || !payload.success || !payload.data?.user) {
          throw new Error(payload.message || 'Unable to verify your session');
        }
        if (active) setUser(payload.data.user);
      } catch (error) {
        console.error(error);
        if (active) {
          setAuthError(error.message || 'Unable to verify your session. Check your connection and try again.');
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const handleLoginSuccess = (nextUser) => {
    setAuthError('');
    setUser(nextUser);
  };

  const handleLogout = async () => {
    try {
      const response = await apiFetch('/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Unable to sign out');
      setUser(null);
    } catch (error) {
      console.error(error);
      setToast('Unable to sign out. Please try again.');
    }
  };

  if (authLoading) {
    return <div className="auth-loading" role="status">Checking your session...</div>;
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage onLoginSuccess={handleLoginSuccess} initialError={authError} />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <SignupPage />} />
      <Route path="/dashboard/*" element={user ? <AuthenticatedApp user={user} onLogout={handleLogout} toast={toast} setToast={setToast} /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}

function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await apiFetch('/dashboard');
        const payload = await response.json();
        setDashboard(payload.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading || !dashboard) {
    return <PageSkeleton />;
  }

  const period = dashboard.period || {};
  const summaryCards = [
    { label: 'Today', value: period.todayTotal || 0, icon: <CalendarDays size={18} />, trend: '+8.2%' },
    { label: 'This Week', value: period.weekTotal || 0, icon: <TrendingUp size={18} />, trend: '+12.4%' },
    { label: 'This Month', value: period.monthTotal || 0, icon: <Wallet size={18} />, trend: '+15.0%' },
    { label: 'This Year', value: period.yearTotal || 0, icon: <CircleDollarSign size={18} />, trend: '+18.6%' },
    { label: 'Transport', value: period.transportTotal || 0, icon: <Gauge size={18} />, trend: '+6.8%' },
    { label: 'Food', value: period.foodTotal || 0, icon: <Receipt size={18} />, trend: '+4.9%' },
    { label: 'Other', value: period.otherTotal || 0, icon: <DollarSign size={18} />, trend: '+2.1%' },
    { label: 'Transactions', value: period.totalTransactions || 0, icon: <CreditCard size={18} />, trend: '+9.1%' },
    { label: 'Highest Expense', value: period.highestExpense || 0, icon: <ArrowUpRight size={18} />, trend: '+13.7%' },
    { label: 'Average Daily', value: period.averageDailyExpense || 0, icon: <RefreshCw size={18} />, trend: '+5.2%' }
  ];

  const lineData = dashboard.charts?.trend || [];
  const pieData = (dashboard.charts?.categoryBreakdown || []).map((item) => ({ ...item, name: item.name || 'Other' }));
  const barData = dashboard.charts?.monthlySpend || [];
  const currencyData = dashboard.charts?.currencyBreakdown || [];

  return (
    <div className="page-stack">
      <section className="summary-grid">
        {summaryCards.map((card) => (
          <div className="stat-card" key={card.label}>
            <div className="stat-header">
              <span className="stat-label">{card.label}</span>
              <span className="stat-icon">{card.icon}</span>
            </div>
            <div className="stat-value">{formatCurrency(card.value, 'SGD')}</div>
            <div className="stat-trend positive">{card.trend} vs previous period</div>
          </div>
        ))}
      </section>

      <section className="quick-actions">
        <QuickActionCard to="/add-expense" title="Add Expense" text="Log a purchase or daily transport entry" icon={<Plus size={18} />} />
        <QuickActionCard to="/history" title="View History" text="Check recent expenses and filters" icon={<Eye size={18} />} />
        <QuickActionCard to="/reports" title="Monthly Report" text="Review summaries and charts" icon={<FileText size={18} />} />
        <QuickActionCard to="/reports" title="Export Report" text="Download Excel or PDF" icon={<DownloadCloud size={18} />} />
      </section>

      <section className="chart-grid">
        <div className="panel panel-wide">
          <div className="panel-header">
            <h3>Expense Trend</h3>
            <span className="muted">Last 7 days</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={lineData}>
              <defs>
                <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#5b7cff" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#5b7cff" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value, 'SGD')} />
              <Area type="monotone" dataKey="total" stroke="#5b7cff" fill="url(#trendFill)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Category Breakdown</h3>
            <span className="muted">Live totals</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="total" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                {pieData.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={['#5b7cff', '#24c6a4', '#f59e0b', '#ef476f', '#8b5cf6', '#f97316', '#10b981', '#3b82f6'][index % 8]} />)}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value, 'SGD')} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-grid">
        <div className="panel">
          <div className="panel-header">
            <h3>Monthly Spending</h3>
            <span className="muted">6 month view</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value, 'SGD')} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#24c6a4" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Transport vs Other</h3>
            <span className="muted">Current period</span>
          </div>
          <div className="mini-compare">
            <div>
              <span className="muted">Transport</span>
              <strong>{formatCurrency(dashboard.charts?.transportVsOther?.transport || 0, 'SGD')}</strong>
            </div>
            <div>
              <span className="muted">Other</span>
              <strong>{formatCurrency(dashboard.charts?.transportVsOther?.other || 0, 'SGD')}</strong>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[
              { name: 'Transport', value: dashboard.charts?.transportVsOther?.transport || 0 },
              { name: 'Other', value: dashboard.charts?.transportVsOther?.other || 0 }
            ]}>
              <XAxis dataKey="name" />
              <Tooltip formatter={(value) => formatCurrency(value, 'SGD')} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Currency Breakdown</h3>
          <span className="muted">Converted totals</span>
        </div>
        <div className="currency-stack">
          {(currencyData.length ? currencyData : [{ currency: 'SGD', total: 0 }]).map((item) => (
            <div className="currency-row" key={item.currency}>
              <span>{item.currency}</span>
              <strong>{formatCurrency(item.total, item.currency || 'SGD')}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AddExpensePage({ setToast }) {
  const [categories, setCategories] = useState(defaultCategories);
  const [transportAmount, setTransportAmount] = useState('5');
  const [transportCurrency, setTransportCurrency] = useState('SGD');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseTime, setExpenseTime] = useState(new Date().toTimeString().slice(0, 5));
  const [items, setItems] = useState([
    { category: 'Lunch', description: 'Chicken rice', amount: '8.50', currency: 'SGD', notes: '' }
  ]);

  useEffect(() => {
    apiFetch('/categories')
      .then((response) => response.json())
      .then((payload) => {
        if (payload.data?.length) {
          setCategories(payload.data.map((item) => item.name));
        }
      })
      .catch(() => setCategories(defaultCategories));
  }, []);

  const totalPreview = useMemo(() => buildItemPreview(items, Number(transportAmount || 0), transportCurrency), [items, transportAmount, transportCurrency]);

  const updateItem = (index, field, value) => {
    const next = [...items];
    next[index][field] = value;
    setItems(next);
  };

  const addItem = () => {
    setItems((current) => [...current, { category: 'Other', description: '', amount: '', currency: 'SGD', notes: '' }]);
  };

  const removeItem = (index) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const submitExpense = async () => {
    const payload = {
      expenseDate,
      expenseTime,
      transportAmount: Number(transportAmount || 0),
      transportCurrency,
      items: items.map((item) => ({
        category: item.category || 'Other',
        description: item.description || 'Expense item',
        amount: Number(item.amount || 0),
        currency: (item.currency || 'SGD').toUpperCase(),
        notes: item.notes || ''
      }))
    };

    const response = await apiFetch('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      setToast(result.message || 'Unable to save expense');
      return;
    }

    setToast('Expense saved successfully');
    setTransportAmount('0');
    setItems([{ category: 'Lunch', description: '', amount: '', currency: 'SGD', notes: '' }]);
  };

  return (
    <div className="page-stack">
      <section className="panel form-panel">
        <div className="panel-header split-header">
          <h3>Add Expense</h3>
          <div className="inline-fields compact">
            <label>
              Date
              <input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
            </label>
            <label>
              Time
              <input type="time" value={expenseTime} onChange={(event) => setExpenseTime(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="transport-row">
          <label>
            Daily Transport Charge
            <input type="number" min="0" step="0.01" value={transportAmount} onChange={(event) => setTransportAmount(event.target.value)} />
          </label>
          <label>
            Currency
            <select value={transportCurrency} onChange={(event) => setTransportCurrency(event.target.value)}>
              {defaultCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
        </div>

        <div className="item-group">
          {items.map((item, index) => (
            <div key={`item-${index}`} className="expense-item-card">
              <div className="expense-item-header">
                <strong>Expense Item {index + 1}</strong>
                <button type="button" className="text-button danger" onClick={() => removeItem(index)}>Remove</button>
              </div>

              <div className="two-column-grid">
                <label>
                  Category
                  <select value={item.category} onChange={(event) => updateItem(index, 'category', event.target.value)}>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label>
                  Description
                  <input type="text" value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} placeholder="e.g. Chicken rice" />
                </label>
              </div>

              <div className="two-column-grid">
                <label>
                  Amount
                  <input type="number" min="0" step="0.01" value={item.amount} onChange={(event) => updateItem(index, 'amount', event.target.value)} placeholder="0.00" />
                </label>
                <label>
                  Currency
                  <select value={item.currency} onChange={(event) => updateItem(index, 'currency', event.target.value)}>
                    {defaultCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </label>
              </div>

              <label>
                Notes
                <textarea rows="2" value={item.notes} onChange={(event) => updateItem(index, 'notes', event.target.value)} placeholder="Optional notes" />
              </label>
            </div>
          ))}
        </div>

        <div className="form-actions-panel">
          <button type="button" className="secondary-button" onClick={addItem}>Add Item</button>
          <div className="summary-pill">
            <span>Preview total</span>
            <strong>{formatCurrency(totalPreview, 'SGD')}</strong>
          </div>
          <button type="button" className="primary-button" onClick={submitExpense}>Save Expense</button>
        </div>
      </section>
    </div>
  );
}

function HistoryPage({ setToast }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const fetchExpenses = async (nextPage = page) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(nextPage));
    params.set('limit', '10');
    const response = await apiFetch(`/expenses?${params.toString()}`);
    const payload = await response.json();
    setRows(payload.data || []);
  };

  useEffect(() => {
    fetchExpenses(page);
  }, [search, page]);

  const removeExpense = async (id) => {
    const response = await apiFetch(`/expenses/${id}`, { method: 'DELETE' });
    const payload = await response.json();
    setToast(payload.message || 'Expense deleted');
    fetchExpenses(page);
  };

  const startEdit = (expense) => {
    setSelected(expense);
    setEditingId(expense.id);
    setEditDraft({
      expenseDate: expense.expenseDate || new Date().toISOString().slice(0, 10),
      expenseTime: expense.expenseTime || '09:00',
      transportAmount: String(expense.transportAmount || 0),
      transportCurrency: expense.transportCurrency || 'SGD',
      items: (expense.items || []).map((item) => ({
        category: item.category || 'Other',
        description: item.description || '',
        amount: String(item.amount || 0),
        currency: item.currency || 'SGD',
        notes: item.notes || ''
      }))
    });
  };

  const updateEditField = (field, value) => {
    setEditDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const updateEditItem = (index, field, value) => {
    setEditDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
      };
    });
  };

  const addEditItem = () => {
    setEditDraft((current) => current ? {
      ...current,
      items: [...current.items, { category: 'Other', description: '', amount: '0', currency: 'SGD', notes: '' }]
    } : current);
  };

  const removeEditItem = (index) => {
    setEditDraft((current) => current ? {
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index)
    } : current);
  };

  const saveEditedExpense = async () => {
    if (!editDraft || !editingId) return;

    const payload = {
      expenseDate: editDraft.expenseDate,
      expenseTime: editDraft.expenseTime,
      transportAmount: Number(editDraft.transportAmount || 0),
      transportCurrency: editDraft.transportCurrency,
      items: editDraft.items.map((item) => ({
        category: item.category || 'Other',
        description: item.description || 'Expense item',
        amount: Number(item.amount || 0),
        currency: (item.currency || 'SGD').toUpperCase(),
        notes: item.notes || ''
      }))
    };

    const response = await apiFetch(`/expenses/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    setToast(result.message || 'Expense updated');
    setSelected(null);
    setEditingId(null);
    setEditDraft(null);
    await fetchExpenses(page);
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header split-header">
          <h3>Expense History</h3>
          <div className="search-box">
            <Search size={16} />
            <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description or category" />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>SGD Amount</th>
                <th>Transport</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.expenseDate}</td>
                  <td>{expense.items[0]?.category || 'Other'}</td>
                  <td>{expense.items[0]?.description || 'Expense item'}</td>
                  <td>{expense.items[0]?.amount || 0}</td>
                  <td>{expense.items[0]?.currency || 'SGD'}</td>
                  <td>{formatCurrency(expense.items.reduce((sum, item) => sum + Number(item.sgdAmount || 0), 0), 'SGD')}</td>
                  <td>{formatCurrency(expense.transportAmount || 0, expense.transportCurrency || 'SGD')}</td>
                  <td>{formatCurrency(expense.totalSgd || 0, 'SGD')}</td>
                  <td className="action-cell">
                    <button type="button" className="text-button" onClick={() => setSelected(expense)}>View</button>
                    <button type="button" className="text-button" onClick={() => startEdit(expense)}>Edit</button>
                    <button type="button" className="text-button danger" onClick={() => removeExpense(expense.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <div className="modal-backdrop" onClick={() => { setSelected(null); setEditingId(null); setEditDraft(null); }}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header split-header">
              <h3>{editingId ? 'Edit Expense' : 'Expense Details'}</h3>
              <button className="text-button" type="button" onClick={() => { setSelected(null); setEditingId(null); setEditDraft(null); }}>Close</button>
            </div>

            {editingId && editDraft ? (
              <>
                <div className="detail-grid">
                  <label>
                    <span>Date</span>
                    <input type="date" value={editDraft.expenseDate} onChange={(event) => updateEditField('expenseDate', event.target.value)} />
                  </label>
                  <label>
                    <span>Time</span>
                    <input type="time" value={editDraft.expenseTime} onChange={(event) => updateEditField('expenseTime', event.target.value)} />
                  </label>
                  <label>
                    <span>Transport</span>
                    <input type="number" min="0" step="0.01" value={editDraft.transportAmount} onChange={(event) => updateEditField('transportAmount', event.target.value)} />
                  </label>
                  <label>
                    <span>Currency</span>
                    <select value={editDraft.transportCurrency} onChange={(event) => updateEditField('transportCurrency', event.target.value)}>
                      {defaultCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                    </select>
                  </label>
                </div>

                <div className="detail-list">
                  {editDraft.items.map((item, index) => (
                    <div className="expense-item-card" key={`edit-item-${index}`}>
                      <div className="expense-item-header">
                        <strong>Item {index + 1}</strong>
                        <button type="button" className="text-button danger" onClick={() => removeEditItem(index)}>Remove</button>
                      </div>

                      <div className="two-column-grid">
                        <label>
                          Category
                          <select value={item.category} onChange={(event) => updateEditItem(index, 'category', event.target.value)}>
                            {defaultCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                          </select>
                        </label>
                        <label>
                          Description
                          <input type="text" value={item.description} onChange={(event) => updateEditItem(index, 'description', event.target.value)} />
                        </label>
                      </div>

                      <div className="two-column-grid">
                        <label>
                          Amount
                          <input type="number" min="0" step="0.01" value={item.amount} onChange={(event) => updateEditItem(index, 'amount', event.target.value)} />
                        </label>
                        <label>
                          Currency
                          <select value={item.currency} onChange={(event) => updateEditItem(index, 'currency', event.target.value)}>
                            {defaultCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                          </select>
                        </label>
                      </div>

                      <label>
                        Notes
                        <textarea rows="2" value={item.notes} onChange={(event) => updateEditItem(index, 'notes', event.target.value)} />
                      </label>
                    </div>
                  ))}
                </div>

                <div className="form-actions-panel">
                  <button type="button" className="secondary-button" onClick={addEditItem}>Add Item</button>
                  <button type="button" className="primary-button" onClick={saveEditedExpense}>Save Changes</button>
                </div>
              </>
            ) : (
              <>
                <div className="detail-grid">
                  <div><span>Date</span><strong>{selected.expenseDate}</strong></div>
                  <div><span>Time</span><strong>{selected.expenseTime}</strong></div>
                  <div><span>Transport</span><strong>{formatCurrency(selected.transportAmount || 0, selected.transportCurrency || 'SGD')}</strong></div>
                  <div><span>Total</span><strong>{formatCurrency(selected.totalSgd || 0, 'SGD')}</strong></div>
                </div>
                <div className="detail-list">
                  {selected.items.map((item) => (
                    <div className="detail-row" key={item.id ?? `${selected.id}-${item.category}-${item.description}`}>
                      <span>{item.category}</span>
                      <span>{item.description}</span>
                      <span>{item.currency} {item.amount}</span>
                      <span>{formatCurrency(item.sgdAmount || 0, 'SGD')}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReportsPage({ setToast }) {
  const [reportType, setReportType] = useState('daily');
  const [summary, setSummary] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const loadReport = async () => {
    const response = await apiFetch(`/reports/${reportType}${reportType === 'daily' ? `?date=${date}` : ''}`);
    const payload = await response.json();
    setSummary(payload.data);
  };

  useEffect(() => {
    loadReport();
  }, [reportType, date]);

  const triggerDownload = async (format) => {
    try {
      const response = await apiFetch(`/export/${format}`);
      if (!response.ok) {
        throw new Error('Unable to export report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `expensepro-report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setToast(`Report exported as ${format === 'excel' ? 'Excel' : 'PDF'}`);
    } catch (error) {
      setToast(error.message || 'Export failed');
    }
  };

  const handleShare = async () => {
    try {
      const response = await apiFetch('/reports/share', { method: 'POST' });
      const payload = await response.json();
      setToast(payload.data?.message || payload.message || 'Report shared');
    } catch (error) {
      setToast('Unable to share report');
    }
  };

  const handleEmail = async () => {
    try {
      const response = await apiFetch('/reports/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: 'demo@expensepro.app',
          subject: 'ExpensePro report',
          message: 'Your monthly expense summary is attached.',
          reportType,
          attachmentFormat: 'PDF'
        })
      });
      const payload = await response.json();
      setToast(payload.message || 'Email queued successfully');
    } catch (error) {
      setToast('Unable to queue email');
    }
  };

  if (!summary) return <PageSkeleton />;

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header split-header">
          <h3>Reports</h3>
          <div className="inline-fields compact">
            {reportType === 'daily' ? <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /> : null}
            <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        <div className="summary-grid report-grid">
          <div className="stat-card compact-card">
            <span>Total</span>
            <strong>{formatCurrency(summary.total || 0, 'SGD')}</strong>
          </div>
          <div className="stat-card compact-card">
            <span>Transactions</span>
            <strong>{summary.transactions || summary.expenses?.length || 0}</strong>
          </div>
          <div className="stat-card compact-card">
            <span>Average</span>
            <strong>{formatCurrency(summary.average || summary.averageDaily || summary.averageMonthly || 0, 'SGD')}</strong>
          </div>
        </div>

        <div className="form-actions-panel">
          <button type="button" className="secondary-button" onClick={() => triggerDownload('excel')}>Export Excel</button>
          <button type="button" className="secondary-button" onClick={() => triggerDownload('pdf')}>Export PDF</button>
          <button type="button" className="secondary-button" onClick={handleShare}>Share Report</button>
          <button type="button" className="primary-button" onClick={handleEmail}>Email Report</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(summary.expenses || []).slice(0, 6).map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.expenseDate}</td>
                  <td>{expense.items[0]?.category || 'Other'}</td>
                  <td>{expense.items[0]?.description || 'Expense item'}</td>
                  <td>{formatCurrency(expense.totalSgd || 0, 'SGD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function BudgetsPage({ setToast }) {
  const [budgets, setBudgets] = useState([]);
  const [category, setCategory] = useState(defaultCategories[0] || 'Lunch');
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [amount, setAmount] = useState('250');

  const loadBudgets = async () => {
    const response = await apiFetch('/budgets');
    const payload = await response.json();
    setBudgets(payload.data || []);
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const saveBudget = async () => {
    const response = await apiFetch('/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, month: Number(month), year: Number(year), amount: Number(amount), currency: 'SGD' })
    });
    const payload = await response.json();
    setToast(payload.message || 'Budget saved');
    setCategory(defaultCategories[0] || 'Lunch');
    await loadBudgets();
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Budget Management</h3>
        </div>
        <div className="inline-fields">
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {defaultCategories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Month
            <input type="number" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <label>
            Year
            <input type="number" value={year} onChange={(event) => setYear(event.target.value)} />
          </label>
          <label>
            Amount
            <input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <button type="button" className="primary-button" onClick={saveBudget}>Save Budget</button>
        </div>

        <div className="budget-list">
          {budgets.map((budget) => (
            <div key={budget.id} className="budget-card">
              <div className="budget-topline">
                <strong>{budget.category}</strong>
                <span>{budget.year}-{String(budget.month).padStart(2, '0')}</span>
              </div>
              <div className="meter">
                <div className="meter-fill" style={{ width: `${Math.min(100, budget.percent || 0)}%` }} />
              </div>
              <div className="budget-values">
                <span>Budget: {formatCurrency(budget.budgetAmount || 0, budget.currency || 'SGD')}</span>
                <span>Spent: {formatCurrency(budget.spent || 0, budget.currency || 'SGD')}</span>
                <span>Remaining: {formatCurrency(budget.remaining || 0, budget.currency || 'SGD')}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CategoriesPage({ setToast }) {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', icon: '📌' });

  const loadCategories = async () => {
    const response = await apiFetch('/categories');
    const payload = await response.json();
    setCategories(payload.data || []);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const addCategory = async () => {
    const response = await apiFetch('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const payload = await response.json();
    setToast(payload.message || 'Category saved');
    setForm({ name: '', description: '', icon: '📌' });
    await loadCategories();
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Categories</h3>
        </div>
        <div className="inline-fields">
          <label>
            Name
            <input type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Description
            <input type="text" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <label>
            Icon
            <input type="text" value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} />
          </label>
          <button type="button" className="primary-button" onClick={addCategory}>Add Category</button>
        </div>
        <div className="chip-list">
          {categories.map((category) => (
            <span className="chip" key={category.id}>{category.icon} {category.name}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function CurrenciesPage({ setToast }) {
  const [currencies, setCurrencies] = useState([]);
  const [form, setForm] = useState({ code: 'USD', name: 'US Dollar', exchangeRate: '1.32' });

  const loadCurrencies = async () => {
    const response = await apiFetch('/currencies');
    const payload = await response.json();
    setCurrencies(payload.data || []);
  };

  useEffect(() => {
    loadCurrencies();
  }, []);

  const saveCurrency = async () => {
    const response = await apiFetch('/currencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: form.code,
        name: form.name,
        exchangeRate: Number(form.exchangeRate)
      })
    });
    const payload = await response.json();
    setToast(payload.message || 'Currency saved');
    setForm({ code: 'USD', name: 'US Dollar', exchangeRate: '1.32' });
    await loadCurrencies();
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Currencies</h3>
        </div>
        <div className="inline-fields">
          <label>
            Code
            <input type="text" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          </label>
          <label>
            Name
            <input type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Exchange Rate
            <input type="number" value={form.exchangeRate} onChange={(event) => setForm({ ...form, exchangeRate: event.target.value })} step="0.0001" />
          </label>
          <button type="button" className="primary-button" onClick={saveCurrency}>Add Currency</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Currency</th>
                <th>Code</th>
                <th>Exchange Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((currency) => (
                <tr key={currency.id}>
                  <td>{currency.name}</td>
                  <td>{currency.code}</td>
                  <td>{currency.exchange_rate}</td>
                  <td>{currency.is_active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SettingsPage({ setToast }) {
  const [themeChoice, setThemeChoice] = useState('system');

  const saveSettings = () => {
    setToast('Settings saved successfully');
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Settings</h3>
        </div>
        <div className="settings-grid">
          <label>
            Default currency
            <select value="SGD" onChange={() => {}}>
              {defaultCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
          <label>
            Theme
            <select value={themeChoice} onChange={(event) => { setThemeChoice(event.target.value); }}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
          <label>
            Date format
            <select value="DD/MM/YYYY" onChange={() => {}}>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          </label>
          <label>
            Start day of week
            <select value="Monday" onChange={() => {}}>
              <option value="Monday">Monday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </label>
        </div>
        <button type="button" className="primary-button" onClick={saveSettings}>Save Settings</button>
      </section>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="page-stack">
      <section className="summary-grid">
        {[1, 2, 3, 4].map((item) => (
          <div className="stat-card skeleton" key={item} />
        ))}
      </section>
    </div>
  );
}

function QuickActionCard({ title, text, icon, to }) {
  return (
    <NavLink className="quick-card" to={to}>
      <span className="quick-icon">{icon}</span>
      <strong>{title}</strong>
      <small>{text}</small>
    </NavLink>
  );
}
