import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './auth';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function setFetchMock(mock: FetchMock) {
  (globalThis as unknown as { fetch: typeof fetch }).fetch =
    mock as unknown as typeof fetch;
}

// Helper component exposing context state to the DOM.
function Probe() {
  const { status, user, accessToken, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="user-email">{user?.email ?? ''}</div>
      <div data-testid="token">{accessToken ?? ''}</div>
      <button
        onClick={() =>
          login({
            user: {
              id: 'u2',
              email: 'login@example.com',
              name: 'L',
              subscription_tier: 'free',
              created_at: 'now',
            },
            tokens: { access_token: 'login-tok', expires_in: 900 },
          })
        }
      >
        do-login
      </button>
      <button onClick={() => logout()}>do-logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('bootstraps via /auth/refresh + /users/me and becomes authed', async () => {
    const fetchMock: FetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse(200, {
          success: true,
          data: { access_token: 'fresh-tok', expires_in: 900 },
        });
      }
      if (url.endsWith('/users/me')) {
        return jsonResponse(200, {
          success: true,
          data: {
            id: 'u1',
            email: 'boot@example.com',
            name: 'Boot',
            subscription_tier: 'free',
            created_at: 'then',
          },
        });
      }
      throw new Error(`unexpected ${url}`);
    });
    setFetchMock(fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    // Initial render is bootstrapping.
    expect(screen.getByTestId('status').textContent).toBe('bootstrapping');

    // Wait for the bootstrap to resolve.
    await screen.findByText('authed', undefined, { timeout: 2000 });
    expect(screen.getByTestId('user-email').textContent).toBe(
      'boot@example.com',
    );
    expect(screen.getByTestId('token').textContent).toBe('fresh-tok');
  });

  it('falls back to unauthed when /auth/refresh fails', async () => {
    const fetchMock: FetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return jsonResponse(401, {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'no cookie' },
        });
      }
      throw new Error(`unexpected ${url}`);
    });
    setFetchMock(fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await screen.findByText('unauthed', undefined, { timeout: 2000 });
    expect(screen.getByTestId('user-email').textContent).toBe('');
    expect(screen.getByTestId('token').textContent).toBe('');
  });

  it('login() populates state with the bundle', async () => {
    // bootstrap = 401 so we land on 'unauthed' first
    const fetchMock: FetchMock = vi.fn(async () =>
      jsonResponse(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'no' },
      }),
    );
    setFetchMock(fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText('unauthed', undefined, { timeout: 2000 });

    const user = userEvent.setup();
    await user.click(screen.getByText('do-login'));

    expect(screen.getByTestId('status').textContent).toBe('authed');
    expect(screen.getByTestId('user-email').textContent).toBe(
      'login@example.com',
    );
    expect(screen.getByTestId('token').textContent).toBe('login-tok');
  });

  it('logout() clears state and calls /auth/logout', async () => {
    let logoutCalled = false;
    const fetchMock: FetchMock = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        // initial bootstrap unauthed
        return jsonResponse(401, {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'no' },
        });
      }
      if (url.endsWith('/auth/logout')) {
        logoutCalled = true;
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected ${url}`);
    });
    setFetchMock(fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText('unauthed', undefined, { timeout: 2000 });

    const user = userEvent.setup();
    await user.click(screen.getByText('do-login'));
    expect(screen.getByTestId('status').textContent).toBe('authed');

    await act(async () => {
      await user.click(screen.getByText('do-logout'));
    });

    expect(logoutCalled).toBe(true);
    expect(screen.getByTestId('status').textContent).toBe('unauthed');
    expect(screen.getByTestId('user-email').textContent).toBe('');
    expect(screen.getByTestId('token').textContent).toBe('');
  });
});
