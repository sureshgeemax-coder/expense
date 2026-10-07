import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import {
  ArrowDownToLine, ArrowRight, BarChart3, CalendarDays, Check, ChevronDown,
  CircleDollarSign, FileText, LayoutDashboard, LogOut, Menu, Plus, Receipt,
  Search, Settings, ShieldCheck, Sparkles, Wallet, X
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const currencyFallback = [
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' }
];
const colors = ['#4e63f5', '#17a983', '#f3a83b', '#eb687b', '#9368e9', '#38a5c7', '#e27c4b', '#7c91a8', '#d95f9a'];
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const formatAmount = (amount, currency) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
};
const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const displayName = (expense) => expense.custom_item || expense.categories?.name || 'Expense';
const errorMessage = (error) => error?.message || 'Something went wrong. Please try again.';
const authRedirectUrl = () => import.meta.env.VITE_APP_URL?.trim() || window.location.origin;

function dateRange(period, from, to) {
  const end = today();
  if (period === 'custom') return { from, to };
  if (period === 'daily') return { from: end, to: end };
  if (period === 'weekly') {
    const monday = new Date(`${end}T00:00:00`);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return { from: `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`, to: end };
  }
  if (period === 'yearly') return { from: `${new Date().getFullYear()}-01-01`, to: end };
  return { from: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`, to: end };
}

function Brand({ to = '/dashboard', className = 'brand' }) {
  return (
    <Link className={className} to={to}>
      <span className="brand-mark"><img src="/sureshkumar.jpg" alt="" /></span>
      <span>Suresh Packet <span className="brand-accent">Ledger</span></span>
    </Link>
  );
}

async function fetchExpenses() {
  const allRows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('expenses')
      .select('id, category_id, amount, currency_code, spent_on, notes, custom_item, created_at, categories(name, slug)')
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    allRows.push(...(data || []));
    if (!data || data.length < pageSize) return allRows;
  }
}

function ConfigurationNotice() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <Brand to="/" />
        <span className="eyebrow">One-time setup</span>
        <h1>Connect your Supabase project</h1>
        <p>Add the public project URL and anon key to the Vite environment before starting the app. The database migration enables per-user row-level security.</p>
        <pre>{'VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...'}</pre>
        <div className="setup-note"><ShieldCheck size={18} /> Use a publishable key; never put a secret key in the browser.</div>
        <p className="setup-small">Then run <code>supabase/migrations/202610070001_expense_schema.sql</code> in the Supabase SQL Editor.</p>
      </section>
    </main>
  );
}

function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [signupEmailLimited, setSignupEmailLimited] = useState(false);
  const [signupEmailDeliveryFailed, setSignupEmailDeliveryFailed] = useState(false);
  const [confirmationRequired, setConfirmationRequired] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setSignupEmailLimited(false);
    setSignupEmailDeliveryFailed(false);
    setConfirmationRequired(false);
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: { display_name: form.name.trim() },
            emailRedirectTo: authRedirectUrl()
          }
        });
        if (authError) throw authError;
        setNotice(data.session ? 'Account created. Your secure workspace is ready.' : 'Account created. Check your email to confirm your address, then sign in.');
        setMode('login');
      } else if (mode === 'reset') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
          redirectTo: authRedirectUrl()
        });
        if (authError) throw authError;
        setNotice('If an account exists for that email, a password reset link has been sent.');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (authError) throw authError;
      }
    } catch (submitError) {
      const message = errorMessage(submitError);
      if (mode === 'login' && /email not confirmed|email_not_confirmed/i.test(message)) {
        setError('Your account exists, but its email address still needs confirmation. Resend the confirmation email, then open its link before signing in.');
        setConfirmationRequired(true);
      } else if (mode === 'signup' && /email.*rate.?limit|over_email_send_rate_limit/i.test(message)) {
        setError('Supabase Auth has temporarily limited signup emails for this project. This is an email-provider limit, not a problem with the form. If you already have an account, sign in instead. For a new account, wait for the limit to reset or configure custom SMTP in Supabase Auth settings.');
        setSignupEmailLimited(true);
      } else if (mode === 'signup' && /error sending confirmation email|confirmation email/i.test(message)) {
        setError('Gmail rejected the SMTP login: Supabase Auth logs report “534 5.7.9 Application-specific password required.” Generate a Google App Password with 2-Step Verification enabled, then replace the SMTP password in Supabase Auth settings. Do not use your normal Google password. Avoid repeated signup attempts until SMTP is fixed; the account may already appear as unconfirmed in Supabase Auth → Users.');
        setSignupEmailDeliveryFailed(true);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: form.email.trim(),
        options: { emailRedirectTo: authRedirectUrl() }
      });
      if (resendError) throw resendError;
      setConfirmationRequired(false);
      setNotice('Confirmation email sent. Check your inbox and spam folder, then follow the confirmation link before signing in.');
    } catch (resendError) {
      const message = errorMessage(resendError);
      setError(/email.*rate.?limit|over_email_send_rate_limit/i.test(message)
        ? 'Supabase is temporarily limiting confirmation emails. Wait for its email rate-limit window to reset before requesting another message.'
        : `Unable to resend the confirmation email: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand to="/" className="brand auth-brand" />
        <div className="story-copy">
          <span className="eyebrow light">Personal finance, made clear</span>
          <h1>A calmer way to keep track of every dollar.</h1>
          <p>Make sense of your spending with a thoughtfully simple, private expense workspace.</p>
          <div className="story-proof"><ShieldCheck size={17} /> Your expenses are private to your account.</div>
        </div>
        <div className="story-decoration"><div className="story-orb" /><span>Spend with intention.</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <span className="eyebrow">{mode === 'signup' ? 'Get started' : mode === 'reset' ? 'Account recovery' : 'Welcome back'}</span>
          <h2>{mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Sign in to your account'}</h2>
          <p className="subtle">{mode === 'signup' ? 'Start with a secure, personal expense space.' : 'Your spending overview is right where you left it.'}</p>
          <form className="auth-form" onSubmit={submit}>
            {mode === 'signup' && <Field label="Full name"><input required autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="How should we address you?" /></Field>}
            <Field label="Email address"><input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></Field>
            {mode !== 'reset' && <Field label="Password"><input required type="password" minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" /></Field>}
            {error && <div className="feedback error" role="alert">{error}{confirmationRequired && <button className="text-button auth-error-action" type="button" disabled={busy || !form.email.trim()} onClick={resendConfirmation}>{busy ? 'Sending confirmation…' : 'Resend confirmation email'}</button>}{signupEmailLimited && <button className="text-button auth-error-action" type="button" onClick={() => { setMode('login'); setError(''); setNotice(''); setSignupEmailLimited(false); }}>Go to sign in</button>}{signupEmailDeliveryFailed && <a className="text-button auth-error-action" href="https://supabase.com/dashboard/project/cipitrbokchmabdftbgf/auth/smtp" target="_blank" rel="noreferrer">Open Supabase SMTP settings</a>}</div>}
            {notice && <div className="feedback success" role="status">{notice}</div>}
            <button className="button primary full-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'} <ArrowRight size={17} /></button>
          </form>
          <div className="auth-switch">
            {mode === 'signup' ? <>Already have an account? <button onClick={() => { setMode('login'); setError(''); setNotice(''); }}>Sign in</button></> :
              mode === 'reset' ? <button onClick={() => { setMode('login'); setError(''); setNotice(''); }}>Back to sign in</button> :
                <>New to Suresh Packet Ledger? <button onClick={() => { setMode('signup'); setError(''); setNotice(''); }}>Create an account</button></>}
          </div>
          {mode === 'login' && <button className="text-button reset-link" onClick={() => { setMode('reset'); setError(''); setNotice(''); }}>Forgot your password?</button>}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  if (!isSupabaseConfigured) return <ConfigurationNotice />;
  return <AuthGate session={session} setSession={setSession} authLoading={authLoading} setAuthLoading={setAuthLoading} />;
}

function AuthGate({ session, setSession, authLoading, setAuthLoading }) {
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Unable to restore Supabase session:', error.message);
      setSession(data?.session || null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [setAuthLoading, setSession]);

  if (authLoading) return <div className="loading-screen"><span className="spinner" /> Securely loading your workspace…</div>;
  return <Routes>
    <Route path="/dashboard/*" element={session ? <AuthenticatedApp user={session.user} /> : <Navigate to="/" replace />} />
    <Route path="*" element={session ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
  </Routes>;
}

function AuthenticatedApp({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currencies, setCurrencies] = useState(currencyFallback);
  const [profile, setProfile] = useState({ display_name: user.user_metadata?.display_name || '' });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

  const reload = async () => {
    setLoadError('');
    try {
      const [expenseRows, profileResult, categoryResult, currencyResult] = await Promise.all([
        fetchExpenses(),
        supabase.from('profiles').select('display_name').eq('id', user.id).single(),
        supabase.from('categories').select('id, name, slug').order('name'),
        supabase.from('currencies').select('code, name, symbol').order('code')
      ]);
      if (profileResult.error) throw profileResult.error;
      if (categoryResult.error) throw categoryResult.error;
      if (currencyResult.error) throw currencyResult.error;
      setExpenses(expenseRows);
      setProfile(profileResult.data || { display_name: user.user_metadata?.display_name || '' });
      if (categoryResult.data?.length) setCategories(categoryResult.data);
      if (currencyResult.data?.length) setCurrencies(currencyResult.data);
    } catch (loadFailure) {
      setLoadError(errorMessage(loadFailure));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, [user.id]);
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) setToast(error.message);
  };
  const removeExpense = async (id) => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { setToast(error.message); return; }
    setExpenses((rows) => rows.filter((expense) => expense.id !== id));
    setToast('Expense deleted');
  };
  const navigation = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/dashboard/add-expense', label: 'Add expense', icon: Plus },
    { to: '/dashboard/expenses', label: 'All expenses', icon: Receipt },
    { to: '/dashboard/reports', label: 'Reports', icon: FileText },
    { to: '/dashboard/charts', label: 'Charts & insights', icon: BarChart3 },
    { to: '/dashboard/profile', label: 'Profile & settings', icon: Settings }
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <Brand />
        <span className="sidebar-label">WORKSPACE</span>
        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="privacy-card"><span className="privacy-icon"><ShieldCheck size={17} /></span><div><strong>Private by design</strong><span>Your data is visible only to you.</span></div></div>
        <button className="sidebar-logout" onClick={logout}><LogOut size={17} /> Sign out</button>
      </aside>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>Personal finances</strong></div>
          <div className="user-menu">
            <div className="user-avatar">{(profile.display_name || user.email || 'U').trim().charAt(0).toUpperCase()}</div>
            <div className="user-meta"><strong>{profile.display_name || 'My account'}</strong><span>{user.email}</span></div>
            <button className="user-logout" onClick={logout} aria-label="Sign out"><LogOut size={16} /></button>
          </div>
        </header>
        <div className="page-content">
          {loadError && <div className="page-error" role="alert"><strong>We couldn’t load your workspace.</strong><span>{loadError}</span><button className="text-button" onClick={reload}>Try again</button></div>}
          {loading ? <div className="loading-inline"><span className="spinner" /> Loading your expenses…</div> :
            <Routes>
              <Route index element={<DashboardPage expenses={expenses} currencies={currencies} />} />
              <Route path="add-expense" element={<AddExpensePage expenses={expenses} categories={categories} currencies={currencies} user={user} reload={reload} setToast={setToast} />} />
              <Route path="add-expense/:id" element={<AddExpensePage expenses={expenses} categories={categories} currencies={currencies} user={user} reload={reload} setToast={setToast} />} />
              <Route path="expenses" element={<ExpensesPage expenses={expenses} currencies={currencies} onDelete={removeExpense} />} />
              <Route path="reports" element={<ReportsPage expenses={expenses} currencies={currencies} />} />
              <Route path="charts" element={<ChartsPage expenses={expenses} currencies={currencies} />} />
              <Route path="profile" element={<ProfilePage user={user} profile={profile} reload={reload} setToast={setToast} />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>}
        </div>
        <footer className="app-footer">Designed and Maintained by G Sureshkumar</footer>
      </main>
      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}
function Field({ label, children, className = '' }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}</label>;
}
function ButtonLink({ to, children, secondary = false }) {
  return <Link className={`button ${secondary ? 'secondary' : 'primary'}`} to={to}>{children}</Link>;
}
function PeriodSelect({ value, onChange }) {
  return <label className="select-wrap"><CalendarDays size={16} /><select aria-label="Reporting period" value={value} onChange={(event) => onChange(event.target.value)}><option value="daily">Today</option><option value="weekly">This week</option><option value="monthly">This month</option><option value="yearly">This year</option><option value="custom">Custom range</option></select><ChevronDown size={14} /></label>;
}
function PeriodFilter({ period, setPeriod, from, setFrom, to, setTo }) {
  return <div className="filter-bar"><PeriodSelect value={period} onChange={setPeriod} />{period === 'custom' && <div className="date-range"><input aria-label="Start date" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /><span>to</span><input aria-label="End date" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></div>}</div>;
}
function StatCard({ label, value, note, icon: Icon, color = '' }) {
  return <article className="stat-card"><div className={`stat-icon ${color}`}><Icon size={19} /></div><span className="stat-label">{label}</span><strong>{value}</strong><span className="stat-note">{note}</span></article>;
}
function CurrencyTotals({ expenses }) {
  const totals = useMemo(() => expenses.reduce((result, expense) => {
    result[expense.currency_code] = (result[expense.currency_code] || 0) + Number(expense.amount);
    return result;
  }, {}), [expenses]);
  return <div className="currency-totals">{Object.entries(totals).sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => <div className="currency-total" key={currency}><span>{currency}</span><strong>{formatAmount(amount, currency)}</strong></div>)}</div>;
}
function ExpenseTable({ expenses, currencies, onDelete, showActions = false, emptyTitle = 'No expenses yet', emptyCopy = 'Add your first expense to see it here.' }) {
  if (!expenses.length) return <div className="empty-state"><span className="empty-icon"><Receipt size={22} /></span><strong>{emptyTitle}</strong><p>{emptyCopy}</p><Link className="text-link" to="/dashboard/add-expense">Add an expense <ArrowRight size={15} /></Link></div>;
  return <div className="table-scroll"><table><thead><tr><th>ITEM</th><th>CATEGORY</th><th>DATE</th><th>NOTES</th><th className="align-right">AMOUNT</th>{showActions && <th />}</tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}>
    <td><div className="expense-title"><span className="category-dot" style={{ background: colors[Math.abs((expense.categories?.slug || 'other').length * 7) % colors.length] }} /><strong>{displayName(expense)}</strong></div></td>
    <td><span className="category-pill">{expense.categories?.name || 'Other'}</span></td><td>{formatDate(expense.spent_on)}</td><td className="notes-cell">{expense.notes || <span className="muted">—</span>}</td>
    <td className="align-right amount-cell">{formatAmount(expense.amount, expense.currency_code)}</td>{showActions && <td className="row-actions"><Link to={`/dashboard/add-expense/${expense.id}`} aria-label="Edit expense"><Settings size={15} /></Link><button onClick={() => onDelete(expense.id)} aria-label="Delete expense"><X size={15} /></button></td>}
  </tr>)}</tbody></table></div>;
}

function DashboardPage({ expenses, currencies }) {
  const [period, setPeriod] = useState('monthly');
  const [currency, setCurrency] = useState('SGD');
  const [from, setFrom] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`);
  const [to, setTo] = useState(today());
  const range = dateRange(period, from, to);
  const periodExpenses = expenses.filter((expense) => expense.spent_on >= range.from && expense.spent_on <= range.to);
  const currencyExpenses = periodExpenses.filter((expense) => expense.currency_code === currency);
  const spend = currencyExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const daily = useMemo(() => {
    const grouped = currencyExpenses.reduce((result, expense) => {
      result[expense.spent_on] = (result[expense.spent_on] || 0) + Number(expense.amount);
      return result;
    }, {});
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date: formatDate(date).replace(/,\s*\d{4}/, ''), amount }));
  }, [currencyExpenses]);
  const categories = useMemo(() => {
    const grouped = currencyExpenses.reduce((result, expense) => {
      const key = expense.categories?.name || 'Other';
      result[key] = (result[key] || 0) + Number(expense.amount);
      return result;
    }, {});
    return Object.entries(grouped).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [currencyExpenses]);
  const monthExpenses = expenses.filter((expense) => expense.spent_on.slice(0, 7) === today().slice(0, 7));
  const recent = [...expenses].slice(0, 5);
  const activeCurrency = currencies.some((item) => item.code === currency) ? currency : currencies[0]?.code || 'SGD';
  useEffect(() => { if (currency !== activeCurrency) setCurrency(activeCurrency); }, [activeCurrency]);
  return <div className="page-stack">
    <PageHeading eyebrow="YOUR FINANCIAL SNAPSHOT" title="Good to see you." description="Here’s a clear view of where your money went." action={<ButtonLink to="/dashboard/add-expense"><Plus size={17} /> Add expense</ButtonLink>} />
    <section className="hero-panel">
      <div className="hero-copy"><span className="hero-kicker"><Sparkles size={15} /> SPENDING OVERVIEW</span><h2>Small steps make a<br />big difference.</h2><p>Stay present with your spending and build habits that feel right for you.</p><ButtonLink to="/dashboard/reports" secondary>View your report <ArrowRight size={16} /></ButtonLink></div>
      <div className="hero-stats"><div className="hero-stat-label">This month in {activeCurrency}</div><div className="hero-stat-value">{formatAmount(monthExpenses.filter((item) => item.currency_code === activeCurrency).reduce((sum, item) => sum + Number(item.amount), 0), activeCurrency)}</div><div className="hero-stat-foot"><span>{monthExpenses.length} transactions</span><span className="hero-stat-divider" /><span>{Object.keys(monthExpenses.reduce((acc, item) => ({ ...acc, [item.currency_code]: true }), {})).length} currencies</span></div><div className="hero-bar"><span style={{ width: `${Math.min(100, monthExpenses.length * 8)}%` }} /></div><span className="hero-caption">All currency amounts stay in their original currency.</span></div>
      <div className="hero-decoration" aria-hidden="true"><span /><span /><span /></div>
    </section>
    <div className="section-toolbar"><div><h2>Spending at a glance</h2><p>Explore transactions by date and currency.</p></div><div className="toolbar-controls"><PeriodSelect value={period} onChange={setPeriod} />{period === 'custom' && <div className="date-range"><input aria-label="Start date" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /><span>to</span><input aria-label="End date" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></div>}<label className="select-wrap"><CircleDollarSign size={16} /><select aria-label="Currency filter" value={activeCurrency} onChange={(event) => setCurrency(event.target.value)}>{currencies.map((item) => <option key={item.code}>{item.code}</option>)}</select><ChevronDown size={14} /></label></div></div>
    <section className="stats-grid"><StatCard label="In selected period" value={formatAmount(spend, activeCurrency)} note={`${currencyExpenses.length} transactions in ${activeCurrency}`} icon={Wallet} /><StatCard label="All transactions" value={periodExpenses.length} note={`${range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(range.to)}`}`} icon={Receipt} color="mint" /><StatCard label="Top category" value={categories[0]?.name || '—'} note={categories[0] ? formatAmount(categories[0].amount, activeCurrency) : 'No recorded spend'} icon={BarChart3} color="amber" /><StatCard label="Average expense" value={formatAmount(currencyExpenses.length ? spend / currencyExpenses.length : 0, activeCurrency)} note="Per transaction" icon={CircleDollarSign} color="violet" /></section>
    <section className="dashboard-charts">
      <article className="panel chart-panel"><div className="panel-heading"><div><h3>Spending trend</h3><p>Amount spent by day · {activeCurrency}</p></div><span className="chart-legend"><i /> Spend</span></div>{daily.length ? <ResponsiveContainer width="100%" height={260}><AreaChart data={daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5366f4" stopOpacity={0.22} /><stop offset="95%" stopColor="#5366f4" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#eef0f5" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#9399a9', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#9399a9', fontSize: 11 }} /><Tooltip formatter={(value) => formatAmount(value, activeCurrency)} /><Area type="monotone" dataKey="amount" stroke="#5366f4" strokeWidth={2.5} fill="url(#spendFill)" /></AreaChart></ResponsiveContainer> : <ChartEmpty />}</article>
      <article className="panel chart-panel"><div className="panel-heading"><div><h3>Where it goes</h3><p>Category split · {activeCurrency}</p></div></div>{categories.length ? <div className="donut-wrap"><div className="donut-chart"><ResponsiveContainer width="100%" height={230}><PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}><Pie data={categories} dataKey="amount" nameKey="name" innerRadius="56%" outerRadius="82%" paddingAngle={3} stroke="none">{categories.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={(value) => formatAmount(value, activeCurrency)} /></PieChart></ResponsiveContainer></div><div className="legend-list">{categories.slice(0, 4).map((item, index) => <div key={item.name}><span><i style={{ background: colors[index % colors.length] }} />{item.name}</span><strong>{formatAmount(item.amount, activeCurrency)}</strong></div>)}</div></div> : <ChartEmpty />}</article>
    </section>
    <section className="panel recent-panel"><div className="panel-heading"><div><h3>Recent expenses</h3><p>Your latest recorded spending.</p></div><Link className="text-link" to="/dashboard/expenses">View all <ArrowRight size={15} /></Link></div><ExpenseTable expenses={recent} currencies={currencies} /></section>
    <div className="section-footnote"><ShieldCheck size={15} /> No currency conversion is applied. View totals by currency to compare accurately.</div>
  </div>;
}

function AddExpensePage({ expenses, categories, currencies, user, reload, setToast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = id ? expenses.find((expense) => expense.id === id) : null;
  const [form, setForm] = useState({ categoryId: '', customItem: '', amount: '', currency: 'SGD', date: today(), notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!existing) return;
    setForm({ categoryId: existing.category_id || categories.find((item) => item.name === existing.categories?.name)?.id || '', customItem: existing.custom_item || '', amount: String(existing.amount), currency: existing.currency_code, date: existing.spent_on, notes: existing.notes || '' });
  }, [existing?.id, categories]);
  const selectedCategory = categories.find((item) => item.id === form.categoryId);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!selectedCategory) { setError('Choose an expense category.'); return; }
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (selectedCategory.slug === 'other' && !form.customItem.trim()) { setError('Enter a name for this custom expense.'); return; }
    setBusy(true);
    try {
      const payload = { category_id: form.categoryId, custom_item: selectedCategory.slug === 'other' ? form.customItem.trim() : null, amount: Number(form.amount), currency_code: form.currency, spent_on: form.date, notes: form.notes.trim() };
      const result = existing
        ? await supabase.from('expenses').update(payload).eq('id', existing.id)
        : await supabase.from('expenses').insert({ ...payload, user_id: user.id });
      if (result.error) throw result.error;
      await reload();
      setToast(existing ? 'Expense updated' : 'Expense added');
      navigate('/expenses');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  };
  if (id && !existing && !expenses.some((expense) => expense.id === id)) return <div className="page-error">This expense could not be found in your account. <Link className="text-link" to="/dashboard/expenses">Back to expenses</Link></div>;
  return <div className="page-stack">
    <PageHeading eyebrow="EXPENSE ENTRY" title={existing ? 'Update expense' : 'Add an expense'} description="A few details are all it takes to keep your spending in view." />
    <div className="entry-layout"><section className="panel entry-panel"><div className="entry-intro"><span className="entry-step">01</span><div><strong>Expense details</strong><p>Record the item, amount and when it happened.</p></div></div>
      <form className="expense-form" onSubmit={submit}>
        <Field label="Expense category"><select required value={form.categoryId} onChange={update('categoryId')}><option value="">Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
        {selectedCategory?.slug === 'other' && <Field label="Custom expense name"><input required maxLength={120} value={form.customItem} onChange={update('customItem')} placeholder="What would you like to call it?" /></Field>}
        <div className="field-grid"><Field label="Amount"><div className="amount-input"><span>{currencies.find((item) => item.code === form.currency)?.symbol || form.currency}</span><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={update('amount')} placeholder="0.00" /></div></Field><Field label="Currency"><select value={form.currency} onChange={update('currency')}>{currencies.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></Field></div>
        <Field label="Date"><input required type="date" max={today()} value={form.date} onChange={update('date')} /></Field>
        <Field label="Notes (optional)"><textarea rows="3" maxLength={2000} value={form.notes} onChange={update('notes')} placeholder="Add a short note or description…" /></Field>
        {error && <div className="feedback error" role="alert">{error}</div>}
        <div className="form-footer"><span><ShieldCheck size={15} /> Private to your account</span><div><Link className="button secondary" to="/dashboard/expenses">Cancel</Link><button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : existing ? 'Save changes' : 'Save expense'} <ArrowRight size={16} /></button></div></div>
      </form></section>
      <aside className="entry-aside"><div className="aside-art"><span className="art-ring ring-one" /><span className="art-ring ring-two" /><div className="art-card"><span>THIS PURCHASE</span><strong>{form.amount ? formatAmount(form.amount, form.currency) : formatAmount(0, form.currency)}</strong><small>{selectedCategory?.name || 'Expense category'}</small></div></div><h3>Make every entry count.</h3><p>A little awareness goes a long way. Add notes when you want extra context for your future self.</p><div className="aside-tip"><Sparkles size={16} /><span>Amounts are saved in the original currency. No conversion or hidden rates.</span></div></aside></div>
  </div>;
}

function ExpensesPage({ expenses, currencies, onDelete }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [currency, setCurrency] = useState('all');
  const categoryNames = [...new Set(expenses.map((item) => item.categories?.name || 'Other'))].sort();
  const filtered = expenses.filter((expense) => {
    const query = `${displayName(expense)} ${expense.categories?.name || ''} ${expense.notes || ''}`.toLowerCase();
    return query.includes(search.toLowerCase()) && (category === 'all' || expense.categories?.name === category) && (currency === 'all' || expense.currency_code === currency);
  });
  return <div className="page-stack"><PageHeading eyebrow="YOUR RECORDS" title="All expenses" description={`${expenses.length} ${expenses.length === 1 ? 'transaction' : 'transactions'} in your private ledger.`} action={<ButtonLink to="/dashboard/add-expense"><Plus size={17} /> Add expense</ButtonLink>} />
    <section className="panel list-panel"><div className="list-toolbar"><div className="search-input"><Search size={17} /><input aria-label="Search expenses" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, category or note" /></div><div className="list-filters"><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categoryNames.map((name) => <option key={name}>{name}</option>)}</select><select aria-label="Filter by currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="all">All currencies</option>{currencies.map((item) => <option key={item.code}>{item.code}</option>)}</select></div></div><ExpenseTable expenses={filtered} currencies={currencies} onDelete={onDelete} showActions emptyTitle="No matching expenses" emptyCopy={search || category !== 'all' || currency !== 'all' ? 'Try adjusting your search or filters.' : 'Add your first expense to get started.'} /></section>
  </div>;
}

function ReportsPage({ expenses, currencies }) {
  const [period, setPeriod] = useState('monthly');
  const [from, setFrom] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`);
  const [to, setTo] = useState(today());
  const range = dateRange(period, from, to);
  const rows = expenses.filter((expense) => expense.spent_on >= range.from && expense.spent_on <= range.to);
  const categoryTotals = rows.reduce((result, item) => {
    const key = `${item.categories?.name || 'Other'} · ${item.currency_code}`;
    result[key] = (result[key] || 0) + Number(item.amount);
    return result;
  }, {});
  const exportExcel = () => {
    const rowsForExport = [
      ['Date', 'Item', 'Category', 'Amount', 'Currency', 'Notes'],
      ...rows.map((expense) => [expense.spent_on, displayName(expense), expense.categories?.name || 'Other', Number(expense.amount), expense.currency_code, expense.notes || ''])
    ];
    const csv = rowsForExport.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `expense-report-${range.from}-to-${range.to}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };
  const summaryText = `Expense report (${range.from} to ${range.to})\nTransactions: ${rows.length}\n${Object.entries(rows.reduce((result, item) => { result[item.currency_code] = (result[item.currency_code] || 0) + Number(item.amount); return result; }, {})).map(([code, total]) => `Total ${code}: ${formatAmount(total, code)}`).join('\n')}`;
  const share = (channel) => {
    const url = channel === 'whatsapp' ? `https://wa.me/?text=${encodeURIComponent(summaryText)}` : `mailto:?subject=${encodeURIComponent('My expense report')}&body=${encodeURIComponent(summaryText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  return <div className="page-stack report-page"><PageHeading eyebrow="YOUR SPENDING, IN FOCUS" title="Expense reports" description="A clear, detailed summary for the dates that matter to you." action={<PeriodFilter period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo} />} />
    <section className="report-banner"><div><span className="hero-kicker"><FileText size={15} /> REPORT PERIOD</span><h2>{formatDate(range.from)}{range.from !== range.to ? ` — ${formatDate(range.to)}` : ''}</h2><p>Your personal expense summary, ready to review or share.</p></div><div className="report-actions"><button className="button secondary" onClick={() => window.print()}><FileText size={16} /> Save as PDF</button><button className="button primary" onClick={exportExcel}><ArrowDownToLine size={16} /> Export Excel CSV</button></div></section>
    <div className="report-share"><span>Share your summary</span><button className="share-button" onClick={() => share('email')}>Email report</button><button className="share-button whatsapp" onClick={() => share('whatsapp')}>Share on WhatsApp</button><span className="share-note">Opens your email app or WhatsApp with a report summary. No credentials are shared.</span></div>
    <section className="report-summary-grid"><StatCard label="Transactions" value={rows.length} note="In selected period" icon={Receipt} /><StatCard label="Currencies used" value={new Set(rows.map((item) => item.currency_code)).size} note="Original currencies only" icon={CircleDollarSign} color="mint" /><StatCard label="Top category" value={Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0].split(' · ')[0] || '—'} note="By recorded amount" icon={BarChart3} color="amber" /></section>
    <section className="panel report-breakdown"><div className="panel-heading"><div><h3>Totals by currency</h3><p>Amounts are not converted between currencies.</p></div></div><CurrencyTotals expenses={rows} /></section>
    <section className="panel report-breakdown"><div className="panel-heading"><div><h3>Category breakdown</h3><p>Grouped by expense item and currency.</p></div></div>{Object.keys(categoryTotals).length ? <div className="breakdown-list">{Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([key, amount]) => <div className="breakdown-row" key={key}><span>{key}</span><strong>{formatAmount(amount, key.split(' · ').at(-1))}</strong></div>)}</div> : <p className="subtle empty-copy">No expenses in this reporting period.</p>}</section>
    <section className="panel recent-panel"><div className="panel-heading"><div><h3>Expense details</h3><p>{rows.length} transactions included in this report.</p></div></div><ExpenseTable expenses={rows} currencies={currencies} emptyTitle="Nothing to report yet" emptyCopy="Expenses from this period will appear here." /></section>
  </div>;
}

function ChartsPage({ expenses, currencies }) {
  const [period, setPeriod] = useState('monthly');
  const [currency, setCurrency] = useState('SGD');
  const [from, setFrom] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`);
  const [to, setTo] = useState(today());
  const range = dateRange(period, from, to);
  const filtered = expenses.filter((expense) => expense.spent_on >= range.from && expense.spent_on <= range.to);
  const availableCurrency = currencies.some((item) => item.code === currency) ? currency : currencies[0]?.code || 'SGD';
  const byCurrency = filtered.reduce((result, expense) => {
    result[expense.currency_code] = (result[expense.currency_code] || 0) + Number(expense.amount);
    return result;
  }, {});
  const nativeRows = filtered.filter((expense) => expense.currency_code === availableCurrency);
  const byCategory = nativeRows.reduce((result, expense) => {
    const name = expense.categories?.name || 'Other';
    result[name] = (result[name] || 0) + Number(expense.amount);
    return result;
  }, {});
  const byDate = nativeRows.reduce((result, expense) => {
    result[expense.spent_on] = (result[expense.spent_on] || 0) + Number(expense.amount);
    return result;
  }, {});
  const trend = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date: formatDate(date).replace(/,\s*\d{4}/, ''), amount }));
  const categoryData = Object.entries(byCategory).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const currencyCounts = filtered.reduce((result, expense) => {
    result[expense.currency_code] = (result[expense.currency_code] || 0) + 1;
    return result;
  }, {});
  const currencyData = Object.entries(currencyCounts).map(([name, transactions]) => ({ name, transactions })).sort((a, b) => b.transactions - a.transactions);
  return <div className="page-stack"><PageHeading eyebrow="PATTERNS & PERSPECTIVE" title="Charts & insights" description="Explore spending patterns by period, category and currency." action={<PeriodFilter period={period} setPeriod={setPeriod} from={from} setFrom={setFrom} to={to} setTo={setTo} />} />
    <div className="chart-filter-note"><span>Category and trend charts</span><label className="select-wrap"><CircleDollarSign size={16} /><select aria-label="Chart currency" value={availableCurrency} onChange={(event) => setCurrency(event.target.value)}>{currencies.map((item) => <option key={item.code}>{item.code}</option>)}</select><ChevronDown size={14} /></label></div>
    <section className="stats-grid"><StatCard label="Transactions" value={filtered.length} note="Selected date range" icon={Receipt} /><StatCard label={`${availableCurrency} spending`} value={formatAmount(nativeRows.reduce((sum, item) => sum + Number(item.amount), 0), availableCurrency)} note={`${nativeRows.length} transactions`} icon={Wallet} color="mint" /><StatCard label="Categories" value={new Set(filtered.map((item) => item.categories?.name || 'Other')).size} note="Across all currencies" icon={BarChart3} color="amber" /><StatCard label="Currencies" value={Object.keys(byCurrency).length} note="Kept in original currency" icon={CircleDollarSign} color="violet" /></section>
    <section className="dashboard-charts charts-page"><article className="panel chart-panel"><div className="panel-heading"><div><h3>Expense trend</h3><p>{availableCurrency} by day</p></div></div>{trend.length ? <ResponsiveContainer width="100%" height={285}><AreaChart data={trend} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5366f4" stopOpacity={0.22} /><stop offset="95%" stopColor="#5366f4" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#eef0f5" vertical={false} /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#9399a9', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#9399a9', fontSize: 11 }} /><Tooltip formatter={(value) => formatAmount(value, availableCurrency)} /><Area type="monotone" dataKey="amount" stroke="#5366f4" strokeWidth={2.5} fill="url(#chartFill)" /></AreaChart></ResponsiveContainer> : <ChartEmpty />}</article>
      <article className="panel chart-panel"><div className="panel-heading"><div><h3>Spending by category</h3><p>{availableCurrency} · selected period</p></div></div>{categoryData.length ? <ResponsiveContainer width="100%" height={285}><BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 16, left: 12, bottom: 4 }}><CartesianGrid stroke="#eef0f5" horizontal={false} /><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} tick={{ fill: '#687087', fontSize: 11 }} /><Tooltip formatter={(value) => formatAmount(value, availableCurrency)} /><Bar dataKey="amount" fill="#17a983" radius={[0, 6, 6, 0]} barSize={19}>{categoryData.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}</Bar></BarChart></ResponsiveContainer> : <ChartEmpty />}</article>
    </section>
    <section className="panel chart-panel currency-chart"><div className="panel-heading"><div><h3>Transactions by currency</h3><p>Transaction count · selected period</p></div></div>{currencyData.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={currencyData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}><CartesianGrid stroke="#eef0f5" vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#687087', fontSize: 12 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#9399a9', fontSize: 11 }} /><Tooltip formatter={(value) => [`${value} transactions`, 'Count']} /><Bar dataKey="transactions" fill="#5366f4" radius={[6, 6, 0, 0]} barSize={40}>{currencyData.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}</Bar></BarChart></ResponsiveContainer> : <ChartEmpty />}<div className="chart-currency-totals"><strong>Recorded amount by currency</strong><CurrencyTotals expenses={filtered} /></div></section>
    <div className="section-footnote"><ShieldCheck size={15} /> Each currency is shown independently. There are no assumed exchange rates.</div>
  </div>;
}

function ChartEmpty() {
  return <div className="chart-empty"><BarChart3 size={24} /><span>No spending data for this selection.</span></div>;
}

function ProfilePage({ user, profile, reload, setToast }) {
  const [name, setName] = useState(profile.display_name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setName(profile.display_name || ''); }, [profile.display_name]);
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: saveError } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', user.id);
    setBusy(false);
    if (saveError) { setError(errorMessage(saveError)); return; }
    await reload();
    setToast('Profile updated');
  };
  return <div className="page-stack"><PageHeading eyebrow="YOUR ACCOUNT" title="Profile & settings" description="Manage your personal details and account security." />
    <div className="profile-layout"><section className="panel profile-panel"><div className="profile-avatar-large">{(name || user.email || 'U').trim().charAt(0).toUpperCase()}</div><h2>{name || 'Your profile'}</h2><p className="subtle">{user.email}</p><span className="account-status"><ShieldCheck size={15} /> Secure personal account</span></section>
      <section className="panel settings-panel"><div className="panel-heading"><div><h3>Personal information</h3><p>Update the name shown in your workspace.</p></div></div><form className="settings-form" onSubmit={save}><Field label="Display name"><input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></Field><Field label="Email address"><input disabled value={user.email || ''} /></Field>{error && <div className="feedback error" role="alert">{error}</div>}<button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <Check size={16} /></button></form></section></div>
    <section className="security-note"><ShieldCheck size={19} /><div><strong>Your data stays yours.</strong><p>Every expense is attached to your signed-in account and protected by Supabase row-level security policies.</p></div></section>
  </div>;
}
