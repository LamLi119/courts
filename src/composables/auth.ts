import { computed, ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const AUTH_TOKEN_KEY = 'theground_access_token';
const REFRESH_TOKEN_KEY = 'theground_refresh_token';

type UserType = 'trainee' | 'coach';

type User = {
  id: number;
  name: string;
  username: string;
  email: string;
  type: UserType;
  avatarSrc?: string;
};

type RegisterPayload = {
  email: string;
  loginId: string;
  name: string;
  phoneNo: string;
  password: string;
  country_code?: string;
  description?: string;
  page?: string;
};

function getApiBase(): string {
  // User auth: prefer The Grind API URL so login/session/refresh use it
  const base = (
    import.meta.env.VITE_THE_GRIND_API_URL ??
    import.meta.env.VITE_API_URL ??
    ''
  ).toString();
  return base.replace(/\/$/, '');
}

function getToken(): string | null {
  try { return localStorage.getItem(AUTH_TOKEN_KEY); } catch { return null; }
}

function setToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearToken() {
  try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch { /* ignore */ }
}

function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_TOKEN_KEY); } catch { return null; }
}

function setRefreshToken(token?: string | null) {
  if (!token) {
    try { localStorage.removeItem(REFRESH_TOKEN_KEY); } catch { /* ignore */ }
    return;
  }
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

function isAuthEndpoint(path: string): boolean {
  return (
    path.includes('/api/user/auth/login')
    || path.includes('/api/user/auth/register')
    || path.includes('/api/user/auth/refresh')
    || path.includes('/api/user/auth/logout')
  );
}

async function refreshTokensDirect(): Promise<{ token: string; refreshToken?: string }> {
  const base = getApiBase();
  const url = `${base}/api/user/auth/refresh`;
  const rt = getRefreshToken();
  if (!rt) throw new Error('No refresh token');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err && (err.error || err.message)) || res.statusText);
  }

  return res.json() as Promise<{ token: string; refreshToken?: string }>;
}

async function apiJson<T>(path: string, options?: RequestInit & { _retry?: boolean }): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const token = getToken();

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });

  // Auto-refresh on 401/403 for non-auth endpoints, then retry once.
  if (!res.ok && (res.status === 401 || res.status === 403) && !options?._retry && !isAuthEndpoint(path)) {
    try {
      const refreshed = await refreshTokensDirect();
      setToken(refreshed.token);
      setRefreshToken(refreshed.refreshToken ?? getRefreshToken());
      return apiJson<T>(path, { ...(options || {}), _retry: true });
    } catch {
      clearToken();
      setRefreshToken(null);
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err && (err.error || err.message)) || res.statusText);
  }

  return res.json() as Promise<T>;
}

export function useAuth() {
  const authStore = useAuthStore();
  const error = ref<string>('');

  const isAuthenticated = computed(() => !!getToken());
  const loading = computed(() => authStore.isLoading);
  const user = computed(() => authStore.user);

  function clearError() {
    error.value = '';
  }

  const login = async (username: string, password: string) => {
    try {
      clearError();
      authStore.setClientStatus(true);
      authStore.setLoading(true);

      const data = await apiJson<{
        token: string;
        refreshToken?: string;
        user: { id: number; name: string; username: string; email: string };
      }>('/api/user/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      setToken(data.token);
      setRefreshToken(data.refreshToken ?? null);
      authStore.setUser({ ...(data.user as any), type: 'trainee' });
      await session();
    } catch (e: any) {
      clearToken();
      setRefreshToken(null);
      authStore.setUser(null);
      error.value = e?.message || 'Login failed';
      throw e;
    } finally {
      authStore.setLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    try {
      clearError();
      authStore.setClientStatus(true);
      authStore.setLoading(true);

      const data = await apiJson<{
        token: string;
        refreshToken?: string;
        user: { id: number; name: string; username: string; email: string; type?: UserType };
      }>('/api/user/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setToken(data.token);
      setRefreshToken(data.refreshToken ?? null);
      authStore.setUser({ ...(data.user as any), type: data.user?.type || 'coach' });
      await session();
    } catch (e: any) {
      clearToken();
      setRefreshToken(null);
      authStore.setUser(null);
      error.value = e?.message || 'Register failed';
      throw e;
    } finally {
      authStore.setLoading(false);
    }
  };

  const session = async () => {
    if (authStore.user) return authStore.user;
    if (!getToken()) return null;

    try {
      authStore.setClientStatus(true);
      authStore.setLoading(true);
      const data = await apiJson<{ user: User }>('/api/user/auth/session', { method: 'GET' });
      authStore.setUser(data.user);
      return data.user;
    } catch {
      clearToken();
      setRefreshToken(null);
      authStore.setUser(null);
      return null;
    } finally {
      authStore.setLoading(false);
    }
  };

  const refresh = async () => {
    try {
      authStore.setClientStatus(true);
      authStore.setLoading(true);
      const rt = getRefreshToken();
      if (!rt) throw new Error('No refresh token');
      const data = await apiJson<{ token: string; refreshToken?: string }>('/api/user/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: rt }),
      });
      setToken(data.token);
      setRefreshToken(data.refreshToken ?? rt);
      authStore.setUser(null);
      await session();
    } finally {
      authStore.setLoading(false);
    }
  };

  const logout = async () => {
    clearToken();
    setRefreshToken(null);
    authStore.reset();
  };

  return {
    login,
    register,
    logout,
    refresh,
    session,
    isAuthenticated,
    user,
    loading,
    error,
    clearError,
  };
}