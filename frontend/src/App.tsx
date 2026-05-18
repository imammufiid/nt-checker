import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/auth/RequireAuth';
import HomePage from './pages/HomePage';
import ResultPage from './pages/ResultPage';
import HistoryPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import LogoutRoute from './pages/LogoutRoute';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public */}
        <Route index element={<HomePage />} />
        <Route path="masuk" element={<LoginPage />} />
        <Route path="daftar" element={<SignupPage />} />
        <Route path="keluar" element={<LogoutRoute />} />

        {/* Authenticated */}
        <Route element={<RequireAuth />}>
          <Route path="scan/:id" element={<ResultPage />} />
          <Route path="riwayat" element={<HistoryPage />} />
          <Route path="profil" element={<ProfilePage />} />
          {/* Placeholders for future waves so /hari-ini and /tujuan don't 404
              while authed. Each renders a minimal "coming soon" tile via the
              ProfilePage's own redirect target, but we keep no implementation
              here — Goal/Dashboard land in later waves. */}
        </Route>

        {/* Legacy redirect: /history → /riwayat */}
        <Route path="history" element={<Navigate to="/riwayat" replace />} />
      </Route>
    </Routes>
  );
}
