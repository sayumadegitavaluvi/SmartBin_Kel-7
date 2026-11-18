import { useEffect } from 'react';
import './AuthToast.css';

function AuthToast({
  title,
  message,
  type = 'success',
  onClose,
}) {
  useEffect(() => {
    if (!title) return;

    const timer = setTimeout(() => {
      onClose?.();
    }, 4500);

    return () => clearTimeout(timer);
  }, [title, message, type, onClose]);

  if (!title) return null;

  return (
    <div
      className={`smartbin-auth-toast ${type}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <span
        className="smartbin-auth-toast-icon"
        aria-hidden="true"
      >
        {type === 'error' ? '!' : '✓'}
      </span>

      <div className="smartbin-auth-toast-content">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>

      <button
        type="button"
        className="smartbin-auth-toast-close"
        onClick={onClose}
        aria-label="Tutup notifikasi"
      >
        ×
      </button>
    </div>
  );
}

export default AuthToast;
