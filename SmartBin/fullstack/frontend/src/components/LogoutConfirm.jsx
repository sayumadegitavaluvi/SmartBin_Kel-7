import './LogoutConfirm.css';

function LogoutConfirm({
  open,
  loading = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="smartbin-logout-overlay">
      <section
        className="smartbin-logout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="smartbin-logout-title"
        aria-describedby="smartbin-logout-description"
      >
        <div
          className="smartbin-logout-icon"
          aria-hidden="true"
        >
          ↪
        </div>

        <h2 id="smartbin-logout-title">
          Konfirmasi Logout
        </h2>

        <p id="smartbin-logout-description">
          Apakah Anda yakin ingin keluar dari akun SmartBin?
        </p>

        <div className="smartbin-logout-actions">
          <button
            type="button"
            className="smartbin-logout-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            Batal
          </button>

          <button
            type="button"
            className="smartbin-logout-confirm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Sedang logout...' : 'Ya, Logout'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default LogoutConfirm;
