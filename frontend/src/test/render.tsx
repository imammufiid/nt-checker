import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, type RenderResult } from '@testing-library/react';
import type { AuthStatus } from '../lib/auth';
import type { AuthUser } from '../lib/types';

/**
 * Stub auth state passed to the mocked `useAuth` hook. Tests `vi.mock('../lib/auth')`
 * to inject this — `renderWithAuth` only handles the routing/DOM scaffolding.
 *
 * Why mock the hook rather than wrap a real `<AuthProvider>`?
 * AuthProvider's `useEffect` hits `/auth/refresh` on mount, which would (a) fire
 * during every test render and (b) couple every component spec to the API client.
 * Stubbing at the hook seam is the lighter touch.
 */
export interface StubAuth {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  login: ReturnType<typeof Object>['call'] extends never ? never : (...args: unknown[]) => unknown;
  signup: (...args: unknown[]) => unknown;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  forceLogout: () => void;
}

interface RenderWithAuthOptions {
  /** Initial URL for MemoryRouter. */
  route?: string;
  /** Optional state attached to the initial location (e.g. firstRun banner). */
  routeState?: unknown;
  /**
   * Optional route path. When set, the UI is rendered inside a matching <Route>
   * so `useLocation()` resolves correctly.
   */
  routePath?: string;
}

export interface RenderWithAuthResult extends RenderResult {}

export const DEFAULT_USER: AuthUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  subscription_tier: 'free',
  created_at: '2026-01-01T00:00:00.000Z',
};

/**
 * Render a component tree wrapped in `<MemoryRouter>`. Tests are expected to
 * `vi.mock('../lib/auth')` themselves to provide a stub `useAuth` return value.
 */
export function renderWithAuth(
  ui: ReactNode,
  options: RenderWithAuthOptions = {},
): RenderWithAuthResult {
  const initialEntries = [
    options.routeState !== undefined
      ? { pathname: options.route ?? '/', state: options.routeState }
      : options.route ?? '/',
  ];

  const tree = (
    <MemoryRouter initialEntries={initialEntries}>
      {options.routePath ? (
        <Routes>
          <Route path={options.routePath} element={<>{ui}</>} />
          <Route
            path="*"
            element={<div data-testid="navigated-elsewhere" />}
          />
        </Routes>
      ) : (
        ui
      )}
    </MemoryRouter>
  );

  return render(tree);
}
