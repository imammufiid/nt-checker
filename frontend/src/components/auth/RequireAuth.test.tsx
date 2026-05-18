import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import type { AuthStatus } from '../../lib/auth';

// Mutable mock state — each test sets the values it needs before render.
const authState: {
  status: AuthStatus;
} = { status: 'bootstrapping' };

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    status: authState.status,
    user: null,
    accessToken: null,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(async () => {}),
    refresh: vi.fn(async () => true),
    forceLogout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Helper component on the login route that exposes the navigation state so we
// can assert `state.from.pathname` was preserved.
function LoginRouteProbe() {
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? '';
  return <div data-testid="login-route" data-from={from} />;
}

function renderAtRoute(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route
            path="/profil"
            element={<div data-testid="protected">PROTECTED</div>}
          />
        </Route>
        <Route path="/masuk" element={<LoginRouteProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    authState.status = 'bootstrapping';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the bootstrapping skeleton (no redirect) while AuthProvider is bootstrapping', () => {
    authState.status = 'bootstrapping';
    renderAtRoute('/profil');

    // role=status spinner is present and the protected route is NOT yet shown.
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('protected')).toBeNull();
    expect(screen.queryByTestId('login-route')).toBeNull();
  });

  it('renders the child Outlet when status is authed', () => {
    authState.status = 'authed';
    renderAtRoute('/profil');
    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('redirects to /masuk with state.from when status is unauthed', () => {
    authState.status = 'unauthed';
    renderAtRoute('/profil');

    const probe = screen.getByTestId('login-route');
    expect(probe).toBeInTheDocument();
    expect(probe.getAttribute('data-from')).toBe('/profil');
  });
});
