import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { connectSocket } from './socket.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [toasts, setToasts] = useState([]);

  // One socket per logged-in session; every server push shows a toast and tells pages to reload
  useEffect(() => {
    if (!user) return;
    const socket = connectSocket();
    socket.on('notification', (n) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, ...n }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 7000);
      window.dispatchEvent(new Event('refresh'));
    });
    socket.on('stats:changed', () => window.dispatchEvent(new Event('refresh')));
    socket.on('feed:changed', () => window.dispatchEvent(new Event('refresh')));
    return () => socket.disconnect();
  }, [user]);

  const save = ({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const login = async (enrollment, password) => save(await api('/auth/login', { method: 'POST', body: { enrollment, password } }));
  const register = async (form) => save(await api('/auth/register', { method: 'POST', body: form }));
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, register, logout, toasts }}>{children}</Ctx.Provider>;
}
