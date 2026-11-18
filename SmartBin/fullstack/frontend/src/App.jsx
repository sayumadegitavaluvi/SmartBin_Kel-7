import { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import AuthToast from './components/AuthToast';
import LogoutConfirm from './components/LogoutConfirm';
import {
  getInternalSession,
  getInternalProfile,
  logoutInternal,
  subscribeAuthChanges,
} from './services/authService';
import './App.css';
import './smartbin-theme.css';

function getCurrentPage() {
  return window.location.hash === '#login'
    ? 'login'
    : 'dashboard';
}

function App() {
  const [page, setPage] = useState(getCurrentPage);
  const [profile, setProfile] = useState(null);
  const [toast, setToast] = useState(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    function handleHashChange() {
      setPage(getCurrentPage());
    }

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener(
        'hashchange',
        handleHashChange
      );
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const session = await getInternalSession();

        if (!session) return;

        const userProfile = await getInternalProfile();

        if (active) {
          setProfile(userProfile);
        }
      } catch {
        if (active) {
          setProfile(null);
        }
      }
    }

    restoreSession();

    const unsubscribe = subscribeAuthChanges(
      (event, session) => {
        if (!session) {
          setProfile(null);
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  function handleLoginSuccess(userProfile) {
    setProfile(userProfile);
    setToast({
      title: 'Login Berhasil',
      message: 'Selamat datang di SmartBin. Akun Anda berhasil diverifikasi.',
      type: 'success',
    });
    window.location.hash = '#dashboard';
    setPage('dashboard');
  }

  function handleOpenLogin() {
    window.location.hash = '#login';
    setPage('login');
  }

  function handleLogout() {
    setToast(null);
    setLogoutOpen(true);
  }

  function handleCancelLogout() {
    if (logoutLoading) return;
    setLogoutOpen(false);
  }

  async function handleConfirmLogout() {
    if (logoutLoading) return;

    setLogoutLoading(true);

    try {
      await logoutInternal();

      setProfile(null);
      setLogoutOpen(false);

      window.location.hash = '#dashboard';
      setPage('dashboard');

      setToast({
        title: 'Logout Berhasil',
        message: 'Anda telah keluar dari akun SmartBin dan kembali sebagai Pengunjung.',
        type: 'success',
      });
    } catch (error) {
      setToast({
        title: 'Logout Gagal',
        message: error.message || 'Gagal keluar dari akun. Silakan coba kembali.',
        type: 'error',
      });
    } finally {
      setLogoutLoading(false);
    }
  }

  function handleBack() {
    window.location.hash = '#dashboard';
    setPage('dashboard');
  }

  if (page === 'login') {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onBack={handleBack}
      />
    );
  }

  return (
    <>
      <Dashboard
        profile={profile}
        onLogin={handleOpenLogin}
        onLogout={handleLogout}
      />
      <LogoutConfirm
        open={logoutOpen}
        loading={logoutLoading}
        onCancel={handleCancelLogout}
        onConfirm={handleConfirmLogout}
      />
      {toast && (
        <AuthToast
          title={toast.title}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

export default App;
