import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Chemical', 'Production', 'Instrumentation', 'Other'];

export default function Auth({ mode }) {
  const isRegister = mode === 'register';
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', enrollment: '', hostel: '', department: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) await register(form);
      else await login(form.enrollment, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <header className="login-header">
        <span className="login-logo-tile"><img className="login-logo" src="/nita-logo.png" alt="NIT Agartala" /></span>
        <div className="login-org">
          <span className="login-org-hi">National Institute of Technology</span>
          <span className="login-org-en">Agartala</span>
        </div>
        <span className="login-divider" aria-hidden="true" />
        <h1 className="login-title">Campus Grievance Desk</h1>
      </header>

      <main className="login-main">
        <section className="login-hero">
          <p className="login-eyebrow">Your campus. Your voice.</p>
          <h2 className="login-headline">Make your campus<br /><em>better together.</em></h2>
          <p className="login-sub">A smarter way to report campus issues, share concerns and stay updated on the improvements happening around you.</p>
        </section>

        <form className="login-card" onSubmit={submit}>
          <h2>{isRegister ? 'Student Sign Up' : 'User Login'}</h2>

          {isRegister && (
            <>
              <label htmlFor="name">Full name</label>
              <input id="name" value={form.name} onChange={set('name')} placeholder="Full name" required />
            </>
          )}

          <label htmlFor="enrollment">Enrollment No/Username</label>
          <input id="enrollment" value={form.enrollment} onChange={set('enrollment')} placeholder="Enrollment No/Username" autoComplete="username" required />

          {isRegister && (
            <>
              <label htmlFor="hostel">Hostel</label>
              <input id="hostel" value={form.hostel} onChange={set('hostel')} placeholder="e.g. Aryabhatta Hostel" required />
              <label htmlFor="department">Department</label>
              <select id="department" value={form.department} onChange={set('department')} required>
                <option value="">Select department</option>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </>
          )}

          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={form.password} onChange={set('password')} placeholder="Password" minLength={6} autoComplete={isRegister ? 'new-password' : 'current-password'} required />

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Sign up' : 'Login'}</button>

          <p className="login-switch">
            {isRegister
              ? <>Already have an account? <Link to="/login">Click here to login</Link></>
              : <>Don't have an account? <Link to="/register">Click here to sign up</Link></>}
          </p>
        </form>
      </main>
    </div>
  );
}
