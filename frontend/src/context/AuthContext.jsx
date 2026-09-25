import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authService } from '../api/client';
import { connectRealtime } from '../api/realtime';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('kinexy_user')) || null; } catch { return null; } });
  const [token, setToken] = useState(() => localStorage.getItem('kinexy_token'));
  const saveSession = useCallback((result) => { setUser(result.user); setToken(result.token); localStorage.setItem('kinexy_user', JSON.stringify(result.user)); localStorage.setItem('kinexy_token', result.token); return result.user; }, []);
  const login = useCallback(async (credentials) => saveSession(await authService.login(credentials)), [saveSession]);
  const register = useCallback(async (data) => saveSession(await authService.register(data)), [saveSession]);
  const loginWithGoogle = useCallback(async (credential, role, registration) => saveSession(await authService.google(credential, role, registration)), [saveSession]);
  const logout = useCallback(() => { setUser(null); setToken(null); localStorage.removeItem('kinexy_user'); localStorage.removeItem('kinexy_token'); }, []);
  const becomeCreator = useCallback(async (data) => { const result = await authService.becomeCreator(data); setUser(result.user); setToken(result.token); localStorage.setItem('kinexy_user', JSON.stringify(result.user)); localStorage.setItem('kinexy_token', result.token); return result.user; }, []);
  useEffect(() => { if (!token) return; let active = true; authService.me().then(result => { if (!active) return; setUser(result.user); localStorage.setItem('kinexy_user', JSON.stringify(result.user)); }).catch(() => { if (active) logout(); }); return () => { active = false; }; }, [token, logout]);
  useEffect(() => token ? connectRealtime(token) : undefined, [token]);
  const isSuperadmin = user?.role === 'superadmin';
  const isAdmin = isSuperadmin || user?.role === 'admin';
  const isModerator = isAdmin || user?.role === 'moderator';
  const isCreator = user?.role === 'creator';
  return <AuthContext.Provider value={{ user, token, isAuthenticated: Boolean(token), isSuperadmin, isAdmin, isModerator, isCreator, isAdvertiser: isCreator, login, register, loginWithGoogle, logout, becomeCreator }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider'); return context; }
export default AuthContext;
