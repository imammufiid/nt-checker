import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AuthBundle,
  AuthTokens,
  AuthUser,
  RefreshResponse,
} from './types';
import { authApi } from './api/auth';
import {
  setAuthHooks,
  type AuthClientHooks,
} from './api/client';

export type AuthStatus = 'bootstrapping' | 'authed' | 'unauthed';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
}

interface AuthContextValue extends AuthState {
  login: (bundle: AuthBundle) => void;
  signup: (bundle: AuthBundle) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  /** Hard-clear state without calling /auth/logout — used by the client interceptor. */
  forceLogout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_CACHE_KEY = 'nt:user';

function readCachedUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AuthUser | null): void {
  try {
    if (user) sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // best-effort
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    status: 'bootstrapping',
    user: readCachedUser(),
    accessToken: null,
  }));

  // Refs that stay in sync with state so the client interceptor (which lives
  // outside React) always reads the latest token without re-binding hooks.
  const accessTokenRef = useRef<string | null>(null);
  const inflightRefresh = useRef<Promise<boolean> | null>(null);

  const applyBundle = useCallback(
    (bundle: AuthBundle) => {
      accessTokenRef.current = bundle.tokens.access_token;
      writeCachedUser(bundle.user);
      setState({
        status: 'authed',
        user: bundle.user,
        accessToken: bundle.tokens.access_token,
      });
    },
    [],
  );

  const applyRefresh = useCallback(
    (user: AuthUser | null, tokens: Pick<AuthTokens, 'access_token'>) => {
      accessTokenRef.current = tokens.access_token;
      if (user) writeCachedUser(user);
      setState((prev) => ({
        status: 'authed',
        user: user ?? prev.user,
        accessToken: tokens.access_token,
      }));
    },
    [],
  );

  const forceLogout = useCallback(() => {
    accessTokenRef.current = null;
    inflightRefresh.current = null;
    writeCachedUser(null);
    setState({ status: 'unauthed', user: null, accessToken: null });
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (inflightRefresh.current) return inflightRefresh.current;
    const p = (async () => {
      try {
        const res: RefreshResponse = await authApi.refresh();
        // /auth/refresh returns only { access_token, expires_in }. Hydrate
        // the user object via /users/me only if we don't already have one
        // cached — keeps the boot path to a single round-trip when possible.
        let user = readCachedUser();
        if (!user) {
          try {
            user = await (async () => {
              accessTokenRef.current = res.access_token;
              return await authApi.me();
            })();
          } catch {
            // /users/me failure during bootstrap = treat as unauthed.
            return false;
          }
        }
        applyRefresh(user, { access_token: res.access_token });
        return true;
      } catch {
        return false;
      } finally {
        inflightRefresh.current = null;
      }
    })();
    inflightRefresh.current = p;
    return p;
  }, [applyRefresh]);

  const login = useCallback(
    (bundle: AuthBundle) => applyBundle(bundle),
    [applyBundle],
  );

  const signup = useCallback(
    (bundle: AuthBundle) => applyBundle(bundle),
    [applyBundle],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // fire-and-forget; we clear state regardless
    }
    forceLogout();
  }, [forceLogout]);

  // Wire the client interceptor exactly once (per mount).
  useEffect(() => {
    const hooks: AuthClientHooks = {
      getAccessToken: () => accessTokenRef.current,
      refresh,
      forceLogout,
    };
    setAuthHooks(hooks);
    return () => setAuthHooks(null);
  }, [refresh, forceLogout]);

  // Bootstrap once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await refresh();
      if (cancelled) return;
      if (!ok) {
        // No valid session — but DON'T blow away an already-cached user that
        // was just optimistically rendered: explicitly mark unauthed.
        forceLogout();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      signup,
      logout,
      refresh,
      forceLogout,
    }),
    [state, login, signup, logout, refresh, forceLogout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
