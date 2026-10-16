import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import api, { errMsg } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { accept } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setError('');
    try {
      const { data } = await api.post(`/auth/${mode === 'login' ? 'login' : 'signup'}`, form);
      accept(data); nav('/');
    } catch (err) { setError(errMsg(err)); }
  }
  async function google({ credential }) {
    try { const { data } = await api.post('/auth/google', { credential }); accept(data); nav('/'); }
    catch (err) { setError(errMsg(err)); }
  }

  return (
    <section className="mx-auto max-w-md pt-16">
      <h1 className="font-display text-4xl">{mode === 'login' ? 'Log in' : 'Create your account'}</h1>
      <form onSubmit={submit} className="mt-6 space-y-3 border border-rune bg-vault p-5">
        {mode === 'signup' && <input className="field" placeholder="Name" required value={form.name} onChange={set('name')} aria-label="Name" />}
        <input className="field" type="email" placeholder="Email" required value={form.email} onChange={set('email')} aria-label="Email" />
        <input className="field" type="password" placeholder="Password (6+ characters)" required minLength={6} value={form.password} onChange={set('password')} aria-label="Password" />
        {error && <p className="text-bad" role="alert">{error}</p>}
        <button className="btn btn-primary w-full">{mode === 'login' ? 'Log in' : 'Sign up'}</button>
        {import.meta.env.VITE_GOOGLE_CLIENT_ID && !import.meta.env.VITE_GOOGLE_CLIENT_ID.includes('your_google') ? (
          <div className="flex justify-center pt-2">
            <GoogleLogin onSuccess={google} onError={() => setError('Google login failed')} theme="filled_black" />
          </div>
        ) : (
          <p className="pt-2 text-center text-xs text-dust">Email login ready. Add VITE_GOOGLE_CLIENT_ID to enable Google sign-in.</p>
        )}
      </form>
      <button className="mt-4 text-dust underline hover:text-amber" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
      </button>
    </section>
  );
}
