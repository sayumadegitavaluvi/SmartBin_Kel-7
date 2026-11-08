#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <HTTPClient.h>
#include <math.h>

// ========================================================
// SMARTBIN S5-23 - HTTPS POST manual dengan TLS terverifikasi
// Basis: firmware S5-20/S5-22 yang telah diuji; sensor tidak diubah.
// ========================================================

// GPS NEO-6M (pin tidak diubah)
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
TinyGPSCustom satelitTerdeteksi(gps, "GPGSV", 3);
#define GPS_RX 22
#define GPS_TX 23

// AJ-SR04M (pin tidak diubah)
#define TRIG_PIN 18
#define ECHO_PIN 19

// Wi-Fi (isi sendiri, jangan publikasikan kata sandi)
const char* ssid = "ISI_NAMA_WIFI";
const char* password = "ISI_PASSWORD_WIFI";

// ========================================================
// S5-23: POST HTTPS ke Django melalui Cloudflare Tunnel.
// URL trycloudflare bersifat sementara; pastikan tunnel aktif.
// Ganti token di salinan lokal. JANGAN unggah rahasia ke GitHub.
// ========================================================
const char* API_URL_HTTPS = "https://possibility-bone-distant-restored.trycloudflare.com/api/monitoring/";
const char* DEVICE_TOKEN_UJI = "ISI_TOKEN_PERANGKAT";


// Sertifikat ROOT CA (publik), bukan token atau kunci privat.
// GTS Root R4, SHA-256 fingerprint diverifikasi terhadap pki.goog.
// Verifikasi hostname + rantai sertifikat dilakukan oleh TLS client.
static const char GTS_ROOT_R4[] = R"GTSR4(-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPlwGjvYxqccpBQUjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzuhXyi
QHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/lxKvR
HYqjQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNpADBmAjEA6ED/g94D
9J+uHXqnLrmvT/aDHQ4thQEd0dlq7A/Cr8deVl5c1RxYIigL9zC2L7F8AjEA8GE8
p/SgguMh1YQdc4acLa/KNJvxn7kjNuK8YAOdgLOaVsjh4rsUecrNIdSUtUlD
-----END CERTIFICATE-----
)GTSR4";

// ========================================================
// S5-19 - Batas validasi hasil kesepakatan tim
// ========================================================
const float TINGGI_TONG_CM = 55.0f; // Penggaris
const float MARGIN_CM = 2.0f;
const float JARAK_MIN_VALID_CM = 20.0f; // Sementara, sesuai varian sensor
const float JARAK_MAX_VALID_CM = TINGGI_TONG_CM + MARGIN_CM; // 57 cm

// ========================================================
// S5-20 - Acuan kalibrasi pembacaan SENSOR
// ========================================================
const float JARAK_KOSONG_CM = 54.8f; // 0%, hasil uji tong kosong
const float JARAK_PENUH_CM = 21.6f;  // 100%, hasil uji batas penuh

// Aturan status tong:
//   jarak < 21.6 cm  -> INDIKASI OVERLOAD, terlalu dekat dengan sensor
//   jarak == 21.6 cm -> PENUH (100%)
//   jarak > 21.6 cm  -> NORMAL, hitung persen seperti kode S5-20 lama
// Tidak ada kunci pasca penuh: pembacaan 22/23/29 cm yang STABIL
// kembali diproses seperti sebelumnya. Kesalahan yang tampak stabil
// masih bisa lolos filter, jadi bukan bukti pasti kondisi fisik tong.

// Setiap 1 detik membaca sensor; BUKAN setiap 1 detik POST API.
const unsigned long INTERVAL_BACA_MS = 1000UL;
unsigned long waktuBacaTerakhir = 0;

// Filter konsistensi awal: sedikitnya 4 dari 5 pembacaan
// dalam kelompok yang rentangnya <= 1.5 cm.
// Angka filter ini PARAMETER UJI, bukan kalibrasi final sensor.
const byte JUMLAH_SAMPEL = 5;
const byte MIN_SAMPEL_STABIL = 4;
const float RENTANG_STABIL_CM = 1.5f;
float riwayatJarak[JUMLAH_SAMPEL];
byte posisiRiwayat = 0;
byte jumlahTercatat = 0;

// Nilai TERAKHIR yang pernah terkonfirmasi; bukan keadaan terbaru
// apabila pembacaan saat ini tidak stabil.
bool adaDataTerakhir = false;
float jarakTerakhirValid = NAN;
float persenTerakhirValid = NAN;

enum StatusJarak {
  SENSOR_VALID,
  SENSOR_TIMEOUT,
  SENSOR_INVALID
};

StatusJarak cekStatusJarak(float jarak) {
  if (jarak == -1.0f) return SENSOR_TIMEOUT;
  if (!isfinite(jarak) ||
      jarak < JARAK_MIN_VALID_CM ||
      jarak > JARAK_MAX_VALID_CM) {
    return SENSOR_INVALID;
  }
  return SENSOR_VALID;
}

float bacaJarak() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long durasi = pulseIn(ECHO_PIN, HIGH, 30000UL);
  if (durasi == 0) return -1.0f; // TIMEOUT
  return durasi * 0.0343f / 2.0f;
}

// S5-20: nilai tidak valid harus dicek TERLEBIH DAHULU.
float hitungKepenuhan(float jarak) {
  if (cekStatusJarak(jarak) != SENSOR_VALID) return NAN;

  // Toleransi khusus kondisi kosong: abaikan fluktuasi <= 0.3 cm.
  // Berbeda dari MARGIN_CM 2 cm pada batas maksimum validasi.
  if (jarak >= JARAK_KOSONG_CM - 0.3f) return 0.0f;

  float persen = (JARAK_KOSONG_CM - jarak) /
                 (JARAK_KOSONG_CM - JARAK_PENUH_CM) * 100.0f;
  // 0% <= hasil <= 100%.
  if (persen < 0.0f) persen = 0.0f;
  if (persen > 100.0f) persen = 100.0f;
  return persen;
}

// S5-22: format JSON tepat sesuai kontrak API Django.
// Fungsi ini hanya membentuk JSON, tidak melakukan POST.
String buatPayloadJSON(float jarakCM, float kepenuhanPersen) {
  if (!isfinite(jarakCM) || !isfinite(kepenuhanPersen)) return "";

  String payload;
  payload.reserve(100);
  payload += "{\"device_id\":\"ESP32-001\",\"distance_cm\":";
  payload += String(jarakCM, 2);
  payload += ",\"fill_percent\":";
  payload += String(kepenuhanPersen, 2);
  payload += "}";
  return payload;
}

// JSON hanya mengambil pembacaan TERBARU yang lolos filter.
// Jangan gunakan data terakhir yang sudah stale.
bool dataJsonTersedia = false;
float jarakUntukJson = NAN;
float persenUntukJson = NAN;

void simpanRiwayat(float jarak) {
  riwayatJarak[posisiRiwayat] = jarak; // Termasuk INVALID/TIMEOUT
  posisiRiwayat = (posisiRiwayat + 1) % JUMLAH_SAMPEL;
  if (jumlahTercatat < JUMLAH_SAMPEL) jumlahTercatat++;
}

// Ambil kelompok empat pembacaan yang saling dekat.
// Sampel INVALID/TIMEOUT tidak dihitung.
// Pembacaan TERBARU juga wajib mendekati kelompok tersebut,
// supaya satu angka bias (misalnya 56 cm) tidak langsung
// dianggap valid meskipun empat data lama masih normal.
bool ambilJarakStabil(float jarakTerbaru, float &jarakStabil) {
  if (jumlahTercatat < JUMLAH_SAMPEL ||
      cekStatusJarak(jarakTerbaru) != SENSOR_VALID) return false;

  float dataValid[JUMLAH_SAMPEL];
  byte n = 0;
  for (byte i = 0; i < JUMLAH_SAMPEL; i++) {
    if (cekStatusJarak(riwayatJarak[i]) == SENSOR_VALID) {
      dataValid[n++] = riwayatJarak[i];
    }
  }
  if (n < MIN_SAMPEL_STABIL) return false;

  // Urutkan nilai valid kecil ke besar (hanya maksimal 5 nilai).
  for (byte i = 1; i < n; i++) {
    float x = dataValid[i];
    int j = (int)i - 1;
    while (j >= 0 && dataValid[j] > x) {
      dataValid[j + 1] = dataValid[j];
      j--;
    }
    dataValid[j + 1] = x;
  }

  bool ditemukan = false;
  float rentangTerbaik = INFINITY;
  float rataTerbaik = NAN;

  for (byte awal = 0; awal + MIN_SAMPEL_STABIL <= n; awal++) {
    byte akhir = awal + MIN_SAMPEL_STABIL - 1;
    float rentang = dataValid[akhir] - dataValid[awal];
    if (rentang <= RENTANG_STABIL_CM && rentang < rentangTerbaik) {
      float jumlah = 0.0f;
      for (byte i = awal; i <= akhir; i++) jumlah += dataValid[i];
      rataTerbaik = jumlah / MIN_SAMPEL_STABIL;
      rentangTerbaik = rentang;
      ditemukan = true;
    }
  }

  if (!ditemukan) return false;
  if (fabsf(jarakTerbaru - rataTerbaik) > RENTANG_STABIL_CM) return false;

  jarakStabil = rataTerbaik;
  return true;
}

void tampilkanHasilJarak(float jarak) {
  StatusJarak status = cekStatusJarak(jarak);
  if (status == SENSOR_TIMEOUT) {
    Serial.println("Jarak mentah  : Tidak terbaca");
    Serial.println("Status Sensor: TIMEOUT");
  } else if (status == SENSOR_INVALID) {
    Serial.print("Jarak mentah  : ");
    Serial.print(jarak, 1);
    Serial.println(" cm");
    Serial.println("Status Sensor: INVALID");
  } else {
    Serial.print("Jarak mentah  : ");
    Serial.print(jarak, 1);
    Serial.println(" cm");
    if (jarak < JARAK_PENUH_CM) {
      Serial.println("Status Sensor: TERLALU DEKAT (indikasi overload)");
    } else {
      Serial.println("Status Sensor: VALID (rentang)");
    }
  }
}

// Pengujian S5-19 terdahulu. Tidak memengaruhi buffer sensor fisik.
void ujiSimulasiS519(char perintah) {
  float jarak;
  switch (perintah) {
    case 'V': case 'v': jarak = 35.0f; break;
    case 'I': case 'i': jarak = 10.0f; break;
    case 'A': case 'a': jarak = 100.0f; break;
    case 'T': case 't': jarak = -1.0f; break;
    default: return;
  }
  Serial.println("=== SIMULASI S5-19, BUKAN DATA SENSOR ===");
  tampilkanHasilJarak(jarak);
  Serial.println("========================================");
}

// Pengujian rumus S5-20 tanpa mengubah buffer pembacaan fisik.
void ujiSimulasiKalibrasi() {
  const float uji[] = {54.8f, 45.33f, 37.3f, 29.7f,
                      23.0f, 22.0f, 21.6f, 20.2f,
                      56.0f, 70.0f, -1.0f};
  Serial.println("=== SIMULASI RUMUS S5-20 ===");
  Serial.println("BUKAN HASIL SENSOR FISIK");
  for (byte i = 0; i < sizeof(uji) / sizeof(uji[0]); i++) {
    float persen = hitungKepenuhan(uji[i]);
    Serial.print("Jarak ");
    if (uji[i] < 0) Serial.print("TIMEOUT");
    else { Serial.print(uji[i], 2); Serial.print(" cm"); }
    Serial.print(" => ");
    if (isnan(persen)) Serial.println("PERSENTASE TIDAK TERSEDIA");
    else {
      Serial.print(persen, 2); Serial.print("%");
      if (uji[i] < JARAK_PENUH_CM) Serial.print(" | INDIKASI OVERLOAD");
      else if (uji[i] <= JARAK_PENUH_CM) Serial.print(" | PENUH");
      Serial.println();
    }
  }
  Serial.println("=============================");
}

// ========================================================
// Sinkronisasi waktu harus berhasil sebelum validasi sertifikat TLS.
// Hanya dipanggil saat pengiriman manual; pembacaan sensor tak diubah.
bool pastikanWaktuNTP() {
  const time_t BATAS_WAKTU_MASUK_AKAL = 1735689600; // 2025-01-01 UTC
  time_t sekarang = time(nullptr);
  if (sekarang < BATAS_WAKTU_MASUK_AKAL) {
    Serial.println("Sinkronisasi waktu ESP32 via NTP ...");
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    unsigned long mulai = millis();
    while (time(nullptr) < BATAS_WAKTU_MASUK_AKAL &&
           millis() - mulai < 20000UL) {
      delay(250);
    }
    sekarang = time(nullptr);
  }
  if (sekarang < BATAS_WAKTU_MASUK_AKAL) {
    Serial.println("GAGAL: waktu NTP belum sinkron; HTTPS dibatalkan.");
    return false;
  }

  struct tm waktuUTC;
  gmtime_r(&sekarang, &waktuUTC);
  char bufferWaktu[32];
  strftime(bufferWaktu, sizeof(bufferWaktu), "%Y-%m-%d %H:%M:%S UTC", &waktuUTC);
  Serial.print("Waktu NTP    : "); Serial.println(bufferWaktu);
  return true;
}

// ========================================================
// S5-23 - Uji HTTPS POST ESP32 -> Django via Cloudflare Tunnel.
// Dipicu hanya dengan huruf P di Serial Monitor.
// Tidak mengirim jika sensor sedang tidak stabil/invalid.
// ========================================================
void kirimMonitoringHTTPSManual() {
  Serial.println();
  Serial.println("===== UJI HTTPS POST S5-23 =====");
  Serial.println("TLS         : verifikasi CA GTS Root R4 aktif");

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("GAGAL: ESP32 belum terhubung Wi-Fi.");
    Serial.println("====================================");
    return;
  }

  if (strlen(DEVICE_TOKEN_UJI) == 0 ||
      strcmp(DEVICE_TOKEN_UJI, "ISI_TOKEN_ASLI_DARI_FULLSTACK") == 0) {
    Serial.println("GAGAL: isi DEVICE_TOKEN_UJI dengan token tes dari Full Stack.");
    Serial.println("Jangan cetak atau bagikan token di log.");
    Serial.println("====================================");
    return;
  }

  if (!dataJsonTersedia || !isfinite(jarakUntukJson) ||
      !isfinite(persenUntukJson)) {
    Serial.println("DIBATALKAN: pembacaan sensor terbaru tidak stabil/valid.");
    Serial.println("Data lama tidak dikirim.");
    Serial.println("====================================");
    return;
  }

  String payload = buatPayloadJSON(jarakUntukJson, persenUntukJson);
  if (payload.length() == 0) {
    Serial.println("GAGAL: JSON tidak bisa dibuat.");
    Serial.println("====================================");
    return;
  }

  if (!pastikanWaktuNTP()) {
    Serial.println("====================================");
    return;
  }

  WiFiClientSecure client;
  client.setCACert(GTS_ROOT_R4); // WAJIB: tidak memakai setInsecure()
  HTTPClient http;
  http.setConnectTimeout(15000);
  http.setTimeout(15000);

  if (!http.begin(client, API_URL_HTTPS)) {
    Serial.println("GAGAL: URL HTTPS tidak dapat diinisialisasi.");
    Serial.println("====================================");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_TOKEN_UJI);

  Serial.print("Endpoint    : "); Serial.println(API_URL_HTTPS);
  Serial.print("Payload     : "); Serial.println(payload);
  Serial.println("Mengirim POST ...");

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    Serial.print("HTTP Status : "); Serial.println(httpCode);
    String body = http.getString();
    Serial.print("Respons API : "); Serial.println(body);
    if (httpCode == 201) {
      Serial.println("HASIL       : HTTPS 201; DITERIMA BACKEND; CEK SUPABASE");
    } else if (httpCode == 400) {
      Serial.println("HASIL       : PAYLOAD DITOLAK (400)");
    } else if (httpCode == 401) {
      Serial.println("HASIL       : TOKEN TIDAK VALID (401)");
    } else if (httpCode == 403) {
      Serial.println("HASIL       : DEVICE TIDAK TERDAFTAR (403)");
    } else {
      Serial.println("HASIL       : RESPON LAIN, PERIKSA LOG DJANGO");
    }
  } else {
    Serial.print("GAGAL TRANSPORT: ");
    Serial.println(http.errorToString(httpCode));
    Serial.println("Cek Wi-Fi, DNS, NTP, sertifikat TLS, dan Cloudflare Tunnel.");
    Serial.println("Jika URL tunnel berubah, minta URL terbaru ke Full Stack.");
  }

  http.end();
  Serial.println("====================================");
  Serial.println();
}

void tampilkanGps() {
  if (gps.location.isValid()) {
    Serial.print("Latitude      : ");
    Serial.println(gps.location.lat(), 6);
    Serial.print("Longitude     : ");
    Serial.println(gps.location.lng(), 6);

    if (gps.satellites.isValid() && gps.satellites.age() < 5000) {
      Serial.print("Satelit digunakan  : ");
      Serial.println(gps.satellites.value());
    } else {
      Serial.println("Satelit digunakan  : Belum tersedia");
    }

    if (satelitTerdeteksi.isValid() && satelitTerdeteksi.age() < 5000) {
      Serial.print("Satelit terdeteksi : ");
      Serial.println(satelitTerdeteksi.value());
    } else {
      Serial.println("Satelit terdeteksi : Belum tersedia");
    }

    if (gps.altitude.isValid()) {
      Serial.print("Altitude      : ");
      Serial.print(gps.altitude.meters(), 2);
      Serial.println(" meter");
    }

    Serial.print("OpenStreetMap : ");
    Serial.print("https://www.openstreetmap.org/?mlat=");
    Serial.print(gps.location.lat(), 6);
    Serial.print("&mlon=");
    Serial.print(gps.location.lng(), 6);
    Serial.print("#map=18/");
    Serial.print(gps.location.lat(), 6);
    Serial.print("/");
    Serial.println(gps.location.lng(), 6);
  } else {
    Serial.println("GPS           : Belum mendapatkan fix");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid, password);

  Serial.println();
  Serial.println("====================================");
  Serial.println(" SMARTBIN S5-20 - KALIBRASI KEPENUHAN");
  Serial.println("====================================");
  Serial.print("Tinggi tong manual  : "); Serial.println(TINGGI_TONG_CM, 1);
  Serial.print("Margin maksimum     : "); Serial.println(MARGIN_CM, 1);
  Serial.print("Acuan kosong (0%)   : "); Serial.println(JARAK_KOSONG_CM, 1);
  Serial.print("Acuan penuh (100%)  : "); Serial.println(JARAK_PENUH_CM, 1);
  Serial.print("Batas validasi      : ");
  Serial.print(JARAK_MIN_VALID_CM, 1); Serial.print(" - ");
  Serial.println(JARAK_MAX_VALID_CM, 1);
  Serial.println("Filter: 4 dari 5 pembacaan serupa (rentang <= 1.5 cm)");
  Serial.println("<21.6 cm: INDIKASI OVERLOAD; 21.6 cm: PENUH");
  Serial.println(">21.6 cm: NORMAL lagi jika pembacaan stabil");
  Serial.println("Tanpa kunci pasca penuh / tanpa reset petugas di ESP32");
  Serial.println("Baca sensor: 1 detik; POST otomatis: BELUM DIAKTIFKAN");
  Serial.println("Uji S5-19: V/I/A/T; uji rumus S5-20: K lalu Enter");
  Serial.println("Uji S5-22: tekan J lalu Enter untuk cetak JSON terbaru");
  Serial.println("Uji HTTPS POST: tekan P lalu Enter (manual; TLS diverifikasi)");
  Serial.println();
}

void loop() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  while (Serial.available() > 0) {
    char input = (char)Serial.read();
    if (input == 'P' || input == 'p') {
      kirimMonitoringHTTPSManual();
    } else if (input == 'J' || input == 'j') {
      Serial.println("=== UJI PAYLOAD JSON S5-22 ===");
      if (dataJsonTersedia) {
        Serial.println(buatPayloadJSON(jarakUntukJson, persenUntukJson));
      } else {
        Serial.println("DATA BELUM STABIL / TIDAK VALID: JSON tidak dibuat");
      }
      Serial.println("BELUM DIKIRIM KE API");
      Serial.println("==============================");
    } else if (input == 'K' || input == 'k') ujiSimulasiKalibrasi();
    else ujiSimulasiS519(input);
  }

  if (millis() - waktuBacaTerakhir >= INTERVAL_BACA_MS) {
    waktuBacaTerakhir = millis();

    float jarakMentah = bacaJarak();
    // Diulang setiap siklus: JSON tidak boleh mewakili data lama.
    dataJsonTersedia = false;
    simpanRiwayat(jarakMentah);

    Serial.println("===== DATA SMARTBIN S5-20 =====");
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Wi-Fi         : TERHUBUNG");
      Serial.print("IP Address    : ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("Wi-Fi         : BELUM TERHUBUNG");
    }

    tampilkanHasilJarak(jarakMentah);

    float jarakStabil = NAN;
    bool stabil = ambilJarakStabil(jarakMentah, jarakStabil);

    if (stabil) {
      float persen = hitungKepenuhan(jarakStabil);
      if (isfinite(persen)) {
        // Tambahan S5-22 saja, tidak mengubah filter / persentase.
        jarakUntukJson = jarakStabil;
        persenUntukJson = persen;
        dataJsonTersedia = true;
        adaDataTerakhir = true;
        jarakTerakhirValid = jarakStabil;
        persenTerakhirValid = persen;
        Serial.println("Kualitas Data  : STABIL");
        Serial.print("Jarak terfilter: ");
        Serial.print(jarakStabil, 2);
        Serial.println(" cm");
        Serial.print("Kepenuhan     : ");
        Serial.print(persen, 2);
        Serial.println("%");

        // PENAMBAHAN SAJA: status tong berdasarkan nilai TERFILTER.
        // Pembacaan NORMAL 22/23/29 cm tetap diproses dan dihitung.
        if (jarakStabil < JARAK_PENUH_CM) {
          Serial.println("Status Tong   : OVERLOAD (indikasi)");
          Serial.println("Keterangan    : Melewati batas penuh 21.6 cm;");
          Serial.println("                mendekati blind zone sensor.");
          Serial.println("                Jarak fisik sebenarnya belum pasti.");
        } else if (jarakStabil <= JARAK_PENUH_CM) {
          Serial.println("Status Tong   : PENUH");
        } else if (persen <= 0.0f) {
          Serial.println("Status Tong   : KOSONG");
        } else if (persen >= 80.0f) {
          Serial.println("Status Tong   : HAMPIR PENUH");
        } else {
          Serial.println("Status Tong   : TERISI");
        }
      }
    } else {
      if (jumlahTercatat < JUMLAH_SAMPEL) {
        Serial.println("Kualitas Data  : MENUNGGU 5 PEMBACAAN");
      } else {
        Serial.println("Kualitas Data  : TIDAK STABIL / TIDAK VALID");
      }
      Serial.println("Kepenuhan     : TIDAK TERSEDIA (saat ini)");
      if (adaDataTerakhir) {
        Serial.print("Terakhir valid: ");
        Serial.print(persenTerakhirValid, 2);
        Serial.println("% (DATA LAMA, BUKAN KONDISI TERBARU)");
      }
    }

    tampilkanGps();
    Serial.println("================================");
    Serial.println();
  }
}
