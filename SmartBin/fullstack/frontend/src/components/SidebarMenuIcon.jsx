function SidebarMenuIcon({ name }) {
  const icons = {
    Dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),

    Monitoring: (
      <path d="M3 13h4l3-8 4 14 3-6h4" />
    ),

    'Riwayat Data': (
      <>
        <path d="M3 11a9 9 0 1 1 2.64 6.36" />
        <path d="M3 3v8h8" />
        <path d="M12 7v5l3 2" />
      </>
    ),

    'Analisis Lokasi': (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),

    Laporan: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h6" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icons[name] ?? icons.Dashboard}
    </svg>
  );
}

export default SidebarMenuIcon;
