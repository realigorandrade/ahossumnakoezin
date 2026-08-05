import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE as THEME_API_BASE } from './theme';

// Define a base da URL apontando corretamente para as rotas com /api do FastAPI
const BASE_URL = THEME_API_BASE && THEME_API_BASE.startsWith('http') 
  ? THEME_API_BASE.replace(/\/$/, '')
  : 'https://ahossumnakoezin.onrender.com';

const API_BASE = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

export type User = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  birthdate: string;
  role: 'user' | 'admin';
};

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<RegisterPayload>) => Promise<User>;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

type RegisterPayload = {
  full_name: string;
  email: string;
  phone: string;
  birthdate: string;
  password: string;
  confirm_password: string;
};

const AuthCtx = createContext<AuthState | undefined>(undefined);

const KEY = 'kwe.session.v1';

async function storeGet(): Promise<string | null> {
  if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  return SecureStore.getItemAsync(KEY);
}

async function storeSet(v: string | null) {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return;
    if (v === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, v);
    return;
  }
  if (v === null) await SecureStore.deleteItemAsync(KEY);
  else await SecureStore.setItemAsync(KEY, v);
}

// Função auxiliar para tratar a leitura de respostas JSON com segurança
async function parseResponse(response: Response) {
  const text = await response.text();
  let data: any = {};
  if (text && text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text };
    }
  }
  return { ok: response.ok, status: response.status, data };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const raw = await storeGet();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setToken(parsed.token);
          setUser(parsed.user);
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (t: string | null, u: User | null) => {
    setToken(t); setUser(u);
    await storeSet(t && u ? JSON.stringify({ token: t, user: u }) : null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const { ok, data } = await parseResponse(r);
    if (!ok) throw new Error(data.detail || data.message || 'Falha no login');

    const userData = data.user || data;
    await persist(data.access_token || '', userData);
    return userData as User;
  }, [persist]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const r = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const { ok, data } = await parseResponse(r);
    if (!ok) throw new Error(data.detail || data.message || 'Falha no cadastro');

    const userData = data.user || data || { role: 'user' };
    await persist(data.access_token || null, userData);
    return userData as User;
  }, [persist]);

  const logout = useCallback(async () => {
    await persist(null, null);
  }, [persist]);

  const authFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers: any = { ...(init.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    
    // Formata o path garantindo a inclusão correta de barras
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return fetch(`${API_BASE}${cleanPath}`, { ...init, headers });
  }, [token]);

  const updateProfile = useCallback(async (patch: Partial<RegisterPayload>) => {
    const r = await authFetch('/auth/profile', { method: 'PUT', body: JSON.stringify(patch) });
    const { ok, data } = await parseResponse(r);
    if (!ok) throw new Error(data.detail || data.message || 'Falha ao atualizar perfil');
    await persist(token, data);
    return data as User;
  }, [authFetch, token, persist]);

  return (
    <AuthCtx.Provider value={{ user, token, loading, login, register, logout, updateProfile, authFetch }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth must be inside AuthProvider');
  return v;
}
