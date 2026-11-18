import './LoginPage.css';
import { useState } from 'react';
import {
  loginInternal,
  logoutInternal,
  getInternalProfile,
} from '../services/authService';

function LoginPage({ onLoginSuccess, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setError('');
    setLoading(true);

    try {
      const cleanEmail = email.trim();

      if (!cleanEmail || !password) {
        throw new Error('Email dan password wajib diisi.');
      }

      await loginInternal(cleanEmail, password);

      const profile = await getInternalProfile();

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(profile);
      }

      setPassword('');
    } catch (err) {
      try {
        await logoutInternal();
      } catch {
        // Jangan menimpa pesan kesalahan utama.
      }

      setError(
        err.message ||
        'Login gagal. Silakan periksa kembali akun Anda.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="smartbin-login-page">
      <section className="smartbin-login-card">
        <div className="smartbin-login-heading">
          <span className="smartbin-login-brand">
            SmartBin
          </span>

          <h1>Login Pengguna Internal</h1>

          <p>
            Masuk menggunakan akun yang terdaftar
            pada sistem SmartBin.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="login-email">
            Email
          </label>

          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="Masukkan email"
            required
            disabled={loading}
          />

          <label htmlFor="login-password">
            Password
          </label>

          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Masukkan password"
            required
            disabled={loading}
          />

          {error && (
            <p role="alert" className="smartbin-login-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <span className="smartbin-login-loading">
                <span
                  className="smartbin-login-spinner"
                  aria-hidden="true"
                />
                Memverifikasi akun...
              </span>
            ) : (
              'Masuk'
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="smartbin-login-back"
        >
          Kembali ke Dashboard Publik
        </button>
      </section>
    </main>
  );
}

export default LoginPage;
