import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import LoginPage from './LoginPage';
import { ApiError } from '../lib/api/client';

// Mock both seams: the api module (so wrong-creds returns an ApiError) and
// the auth hook (so we can capture login() and not fire bootstrap effects).
const loginSpy = vi.fn();
const authMock = {
  status: 'unauthed' as const,
  user: null,
  accessToken: null,
  login: loginSpy,
  signup: vi.fn(),
  logout: vi.fn(async () => {}),
  refresh: vi.fn(async () => true),
  forceLogout: vi.fn(),
};

vi.mock('../lib/auth', () => ({
  useAuth: () => authMock,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const apiLogin = vi.fn();
vi.mock('../lib/api/auth', () => ({
  authApi: {
    login: (...args: unknown[]) => apiLogin(...args),
  },
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/masuk']}>
      <Routes>
        <Route path="/masuk" element={<LoginPage />} />
        <Route path="/" element={<div data-testid="home-after-login" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginSpy.mockReset();
    apiLogin.mockReset();
    authMock.status = 'unauthed';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login form in Bahasa Indonesia at idle', () => {
    renderLogin();
    expect(
      screen.getByRole('heading', { name: 'Masuk ke akunmu' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Kata sandi')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Masuk' }),
    ).toBeInTheDocument();
    // BI-only sanity: there should be no English "Sign in" button text.
    expect(screen.queryByText(/sign in/i)).toBeNull();
  });

  it('on wrong credentials (401 UNAUTHORIZED) shows "Email atau kata sandi salah."', async () => {
    apiLogin.mockRejectedValueOnce(
      new ApiError({
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      }),
    );
    renderLogin();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'imam@example.com');
    await user.type(screen.getByLabelText('Kata sandi'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Masuk' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email atau kata sandi salah.');
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('does not call login() when the API rejects (no false-positive auth)', async () => {
    apiLogin.mockRejectedValueOnce(
      new ApiError({
        status: 429,
        code: 'RATE_LIMITED',
        message: 'too many',
      }),
    );
    renderLogin();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'imam@example.com');
    await user.type(screen.getByLabelText('Kata sandi'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Masuk' }));

    await screen.findByRole('alert');
    expect(loginSpy).not.toHaveBeenCalled();
    // BI rate-limited copy
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Terlalu banyak percobaan. Coba lagi 10 menit lagi.',
    );
  });

  it('successful login triggers useAuth().login(bundle) and navigates away from /masuk', async () => {
    const bundle = {
      user: {
        id: 'u-1',
        email: 'imam@example.com',
        name: 'Imam',
        subscription_tier: 'free',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      tokens: { access_token: 'tok-1', expires_in: 900 },
    };
    apiLogin.mockResolvedValueOnce(bundle);
    renderLogin();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'imam@example.com');
    await user.type(screen.getByLabelText('Kata sandi'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Masuk' }));

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith(bundle);
    });
    // Navigation: when login succeeds the page navigates to '/' which renders
    // our captured route element.
    expect(
      await screen.findByTestId('home-after-login'),
    ).toBeInTheDocument();
  });
});
