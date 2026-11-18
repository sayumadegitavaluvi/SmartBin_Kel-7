import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet';

import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [-5.3565, 105.2321];

function createBinIcon(type) {
  const color = type === 'physical' ? '#24814D' : '#286CE6';

  return L.divIcon({
    className: 'smartbin-custom-location-pin',
    html: `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="26"
        height="36"
        viewBox="0 0 26 36"
        aria-hidden="true"
        style="display:block;overflow:visible;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.24))"
      >
        <path
          d="M13 1.6
             C6.6 1.6 2 6.4 2 12.6
             C2 20.8 13 34.4 13 34.4
             S24 20.8 24 12.6
             C24 6.4 19.4 1.6 13 1.6Z"
          fill="${color}"
          stroke="#ffffff"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
        <circle
          cx="13"
          cy="12.6"
          r="5.8"
          fill="#ffffff"
        />
        <circle
          cx="13"
          cy="12.6"
          r="2.1"
          fill="${color}"
        />
      </svg>
    `,
    iconSize: [26, 36],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
    tooltipAnchor: [0, -27],
  });
}

const physicalIcon = createBinIcon('physical');
const virtualIcon = createBinIcon('virtual');

function prepareBin(bin) {
  const rawLat = bin.lokasi?.latitude;
  const rawLng = bin.lokasi?.longitude;

  if (
    rawLat === null ||
    rawLat === undefined ||
    rawLat === '' ||
    rawLng === null ||
    rawLng === undefined ||
    rawLng === ''
  ) {
    return null;
  }

  const latitude = Number(rawLat);
  const longitude = Number(rawLng);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    ...bin,
    latitude,
    longitude,
  };
}

function formatPercent(value) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return 'Belum ada data';
  }

  return `${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function formatTime(value) {
  if (!value) return 'Belum ada pembacaan';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Waktu tidak tersedia';
  }

  return `${date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  })} WIB`;
}

function MapController({ coordinateKey, expanded, mapRef }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;

    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);

  // Fokus otomatis hanya jika koordinat berubah.
  useEffect(() => {
    if (!coordinateKey) return;

    const coordinates = coordinateKey
      .split('|')
      .map((point) => point.split(',').map(Number));

    if (coordinates.length === 1) {
      map.setView(coordinates[0], 17);
    } else {
      map.fitBounds(coordinates, {
        padding: [40, 40],
        maxZoom: 17,
      });
    }
  }, [coordinateKey, map]);

  // Menyesuaikan ukuran Leaflet saat peta diperbesar.
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [expanded, map]);

  return null;
}

function BinLocationMap({ bins = [] }) {
  const mapRef = useRef(null);
  const [expanded, setExpanded] = useState(false);

  const mappedBins = bins
    .map(prepareBin)
    .filter(Boolean);

  const coordinateKey = mappedBins
    .map((bin) => `${bin.latitude},${bin.longitude}`)
    .join('|');

  const physicalCount = mappedBins.filter(
    (bin) => bin.jenis_tong === 'fisik'
  ).length;

  const virtualCount = mappedBins.filter(
    (bin) => bin.jenis_tong === 'virtual'
  ).length;

  function focusAllMarkers() {
    const map = mapRef.current;

    if (!map || mappedBins.length === 0) return;

    const coordinates = mappedBins.map((bin) => [
      bin.latitude,
      bin.longitude,
    ]);

    map.closePopup();

    if (coordinates.length === 1) {
      map.flyTo(coordinates[0], 17);
    } else {
      map.flyToBounds(coordinates, {
        padding: [45, 45],
        maxZoom: 17,
        duration: 0.6,
      });
    }
  }

  return (
    <div className={`sb-map-shell ${expanded ? 'expanded' : ''}`}>
      <div className="sb-map-toolbar">
        <span className="sb-map-count">
          <span className="sb-map-count-dot" />
          {mappedBins.length} dari {bins.length} titik
        </span>

        <div className="sb-map-actions">
          <button
            type="button"
            onClick={focusAllMarkers}
            disabled={mappedBins.length === 0}
          >
            Lihat semua
          </button>

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Perkecil peta' : 'Perbesar peta'}
          </button>
        </div>
      </div>

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={16}
        scrollWheelZoom={false}
        dragging={true}
        className="sb-map-canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          coordinateKey={coordinateKey}
          expanded={expanded}
          mapRef={mapRef}
        />

        {mappedBins.map((bin) => {
          const isPhysical = bin.jenis_tong === 'fisik';
          const reading = bin.monitoring;
          const sourceLabel =
            reading?.sumber_data === 'fisik'
              ? 'Pembacaan sensor ESP32'
              : reading?.sumber_data === 'simulasi'
                ? 'Data simulasi'
                : 'Belum ada pembacaan';

          return (
            <Marker
              key={bin.id_tong}
              position={[bin.latitude, bin.longitude]}
              icon={isPhysical ? physicalIcon : virtualIcon}
              title={`${bin.kode_tong} - ${bin.lokasi?.nama_lokasi ?? ''}`}
            >
              <Tooltip
                direction="top"
                offset={[0, -12]}
                opacity={0.95}
              >
                {bin.lokasi?.nama_lokasi ?? bin.kode_tong}
              </Tooltip>

              <Popup
                className="sb-map-popup"
                minWidth={190}
                maxWidth={230}
                autoPan={true}
              >
                <div className="sb-popup-content">
                  <div className="sb-popup-heading">
                    <strong>{bin.kode_tong}</strong>

                    <span
                      className={
                        isPhysical
                          ? 'sb-popup-type physical'
                          : 'sb-popup-type virtual'
                      }
                    >
                      {isPhysical ? 'Fisik' : 'Virtual'}
                    </span>
                  </div>

                  <div className="sb-popup-location">
                    {bin.lokasi?.nama_lokasi ??
                      'Nama lokasi belum tersedia'}
                  </div>

                  <div className="sb-popup-divider" />

                  <span className="sb-popup-caption">
                    Tingkat kepenuhan
                  </span>

                  <strong className="sb-popup-percent">
                    {formatPercent(reading?.tingkat_kepenuhan)}
                  </strong>

                  <div className="sb-popup-footer">
                    <span>{sourceLabel}</span>
                    <span>
                      {formatTime(reading?.waktu_pembacaan)}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="sb-map-bottom">
        <div className="sb-map-legend">
          <span>
            <i className="sb-legend-dot physical" />
            Fisik ({physicalCount})
          </span>

          <span>
            <i className="sb-legend-dot virtual" />
            Virtual ({virtualCount})
          </span>
        </div>

        <p className="sb-map-help">
          {mappedBins.length === 0
            ? 'Belum ada koordinat. Lokasi tong belum dapat ditampilkan.'
            : 'Klik penanda untuk melihat detail. Geser peta atau gunakan tombol + dan − untuk memperbesar tampilan.'}
        </p>
      </div>
    </div>
  );
}

export default BinLocationMap;
