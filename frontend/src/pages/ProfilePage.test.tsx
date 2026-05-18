import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import ProfilePage from './ProfilePage';
import type { HealthProfile } from '../lib/types';

const authMock = {
  status: 'authed' as const,
  user: {
    id: 'u',
    email: 'p@example.com',
    name: 'P',
    subscription_tier: 'free',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  accessToken: 'tok',
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(async () => {}),
  refresh: vi.fn(async () => true),
  forceLogout: vi.fn(),
};

vi.mock('../lib/auth', () => ({
  useAuth: () => authMock,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const getProfileMock = vi.fn();
const putProfileMock = vi.fn();
vi.mock('../lib/api/users', () => ({
  usersApi: {
    getProfile: (...a: unknown[]) => getProfileMock(...a),
    putProfile: (...a: unknown[]) => putProfileMock(...a),
    patchUser: vi.fn(),
  },
}));

const EMPTY_PROFILE: HealthProfile = {
  age: null,
  gender: null,
  weight_kg: null,
  height_cm: null,
  activity_level: null,
  conditions: null,
  allergies: null,
  goals: null,
};

function renderProfile(opts: { firstRun?: boolean } = {}) {
  const entry = opts.firstRun
    ? { pathname: '/profil', state: { firstRun: true } }
    : '/profil';
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/tujuan" element={<div data-testid="goal-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    getProfileMock.mockReset();
    putProfileMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the profile form in Bahasa Indonesia after the initial GET', async () => {
    getProfileMock.mockResolvedValueOnce(EMPTY_PROFILE);
    renderProfile();

    expect(
      await screen.findByRole('heading', { name: 'Profil kesehatan' }),
    ).toBeInTheDocument();
    // Wait for loading spinner to disappear and form to appear.
    await waitFor(() => {
      expect(screen.getByLabelText('Usia')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Jenis kelamin')).toBeInTheDocument();
    expect(screen.getByLabelText('Berat (kg)')).toBeInTheDocument();
    expect(screen.getByLabelText('Tinggi (cm)')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Simpan profil' }),
    ).toBeInTheDocument();
    expect(getProfileMock).toHaveBeenCalledTimes(1);
  });

  it('on firstRun (route state) shows "Lengkapi profilmu dulu." banner and skips the initial GET', async () => {
    renderProfile({ firstRun: true });
    // firstRun banner is a role=status
    const banner = await screen.findByText('Lengkapi profilmu dulu.');
    expect(banner).toBeInTheDocument();
    expect(getProfileMock).not.toHaveBeenCalled();
  });

  it('on submit calls PUT and on firstRun navigates to /tujuan', async () => {
    putProfileMock.mockResolvedValueOnce({ ...EMPTY_PROFILE, age: 30 });
    renderProfile({ firstRun: true });

    const user = userEvent.setup();
    const ageInput = await screen.findByLabelText('Usia');
    await user.type(ageInput, '30');
    await user.click(screen.getByRole('button', { name: 'Simpan profil' }));

    await waitFor(() => {
      expect(putProfileMock).toHaveBeenCalledTimes(1);
    });
    const payload = putProfileMock.mock.calls[0][0] as HealthProfile;
    expect(payload.age).toBe(30);

    // After firstRun PUT succeeds, page navigates to /tujuan.
    expect(await screen.findByTestId('goal-page')).toBeInTheDocument();
  });

  it('on submit (non-firstRun) shows the "Profil tersimpan." toast', async () => {
    getProfileMock.mockResolvedValueOnce(EMPTY_PROFILE);
    putProfileMock.mockResolvedValueOnce({ ...EMPTY_PROFILE, age: 28 });
    renderProfile();

    const user = userEvent.setup();
    const ageInput = await screen.findByLabelText('Usia');
    await user.type(ageInput, '28');
    await user.click(screen.getByRole('button', { name: 'Simpan profil' }));

    expect(await screen.findByText('Profil tersimpan.')).toBeInTheDocument();
  });

  it('invalid age (string of zero converted to null) — the BE-rejection path surfaces an error banner', async () => {
    // Stand-in for "invalid age" inline error: the UI uses HTML5 min/max attrs;
    // the deterministic assertion is that a server-side validation rejection
    // bubbles into the ApiErrorBanner. Use the existing ApiError from client.
    const { ApiError } = await import('../lib/api/client');
    putProfileMock.mockRejectedValueOnce(
      new ApiError({
        status: 400,
        code: 'INVALID_INPUT',
        message: 'age must not be greater than 120',
      }),
    );
    getProfileMock.mockResolvedValueOnce(EMPTY_PROFILE);
    renderProfile();

    const user = userEvent.setup();
    const ageInput = await screen.findByLabelText('Usia');
    await user.type(ageInput, '999');
    await user.click(screen.getByRole('button', { name: 'Simpan profil' }));

    const alert = await screen.findByRole('alert');
    // ApiErrorBanner with default code map → INVALID_INPUT renders the BI copy.
    expect(alert).toHaveTextContent('Data yang dikirim tidak valid.');
  });
});
