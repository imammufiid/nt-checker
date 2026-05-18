import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import SignupPage from './SignupPage';
import { ApiError } from '../lib/api/client';

const signupSpy = vi.fn();
const authMock = {
  status: 'unauthed' as const,
  user: null,
  accessToken: null,
  login: vi.fn(),
  signup: signupSpy,
  logout: vi.fn(async () => {}),
  refresh: vi.fn(async () => true),
  forceLogout: vi.fn(),
};

vi.mock('../lib/auth', () => ({
  useAuth: () => authMock,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const apiSignup = vi.fn();
vi.mock('../lib/api/auth', () => ({
  authApi: {
    signup: (...args: unknown[]) => apiSignup(...args),
  },
}));

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/daftar']}>
      <Routes>
        <Route path="/daftar" element={<SignupPage />} />
        <Route path="/profil" element={<div data-testid="profile-after-signup" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SignupPage', () => {
  beforeEach(() => {
    signupSpy.mockReset();
    apiSignup.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the signup form in Bahasa Indonesia', () => {
    renderSignup();
    expect(
      screen.getByRole('heading', { name: 'Buat akun baru' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nama')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Kata sandi')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Daftar' }),
    ).toBeInTheDocument();
    // BI rule — no leaking English copy
    expect(screen.queryByText(/sign up/i)).toBeNull();
  });

  it('weak password (< 8 chars) shows inline error and does not call the API', async () => {
    renderSignup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Nama'), 'Imam');
    await user.type(screen.getByLabelText('Email'), 'imam@example.com');
    await user.type(screen.getByLabelText('Kata sandi'), 'short');
    await user.click(screen.getByRole('button', { name: 'Daftar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Kata sandi minimal 8 karakter.');
    expect(apiSignup).not.toHaveBeenCalled();
    expect(signupSpy).not.toHaveBeenCalled();
  });

  it('duplicate email (409 DUPLICATE_EMAIL) shows "Email sudah terdaftar. Coba masuk."', async () => {
    apiSignup.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: 'DUPLICATE_EMAIL',
        message: 'taken',
      }),
    );
    renderSignup();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Nama'), 'Imam');
    await user.type(screen.getByLabelText('Email'), 'imam@example.com');
    await user.type(screen.getByLabelText('Kata sandi'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Daftar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email sudah terdaftar. Coba masuk.');
    expect(signupSpy).not.toHaveBeenCalled();
  });

  it('successful signup navigates to /profil', async () => {
    const bundle = {
      user: {
        id: 'u-2',
        email: 'imam@example.com',
        name: 'Imam',
        subscription_tier: 'free',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      tokens: { access_token: 'tok-2', expires_in: 900 },
    };
    apiSignup.mockResolvedValueOnce(bundle);
    renderSignup();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Nama'), 'Imam');
    await user.type(screen.getByLabelText('Email'), 'imam@example.com');
    await user.type(screen.getByLabelText('Kata sandi'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Daftar' }));

    await waitFor(() => {
      expect(signupSpy).toHaveBeenCalledWith(bundle);
    });
    expect(
      await screen.findByTestId('profile-after-signup'),
    ).toBeInTheDocument();
  });
});
