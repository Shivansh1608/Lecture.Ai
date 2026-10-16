import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('lecturai_token')) return setReady(true);
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => localStorage.removeItem('lecturai_token')).finally(() => setReady(true));
  }, []);

  const accept = ({ token, user }) => { localStorage.setItem('lecturai_token', token); setUser(user); };
  const logout = () => { localStorage.removeItem('lecturai_token'); setUser(null); };

  return <Ctx.Provider value={{ user, ready, accept, logout }}>{children}</Ctx.Provider>;
}
