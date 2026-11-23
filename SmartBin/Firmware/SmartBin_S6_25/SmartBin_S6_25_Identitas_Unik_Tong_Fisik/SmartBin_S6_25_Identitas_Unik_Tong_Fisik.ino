#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <HTTPClient.h>
#include <math.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include <string.h>

// ========================================================
// SMARTBIN S6-25 - IDENTITAS PERANGKAT DAN TONG (S6-23 + S6-24 + S6-25)
// GPS UART2 dibaca pada task FreeRTOS khusus agar tidak tertahan oleh HTTPS/NTP.
// S6-23: HTTPS otomatis 5 menit. S6-24: reconnect Wi-Fi. S6-25: identitas unik.
// Validasi sensor, kalibrasi, payload API dan pin tetap mengikuti kode sebelumnya.
// Posisi GPS lama TIDAK pernah dianggap fix terbaru.
// Peningkatan buffering tidak menjamin kualitas sinyal satelit/GNSS.
// ========================================================

// GPS NEO-6M (UART2: RX2 = GPIO16, TX2 = GPIO17)
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
TinyGPSCustom satelitTerdeteksi(gps, "GPGSV", 3);
#define GPS_RX 16
#define GPS_TX 17
// Cadangan buffer UART untuk mengurangi data NMEA hilang saat loop sibuk.
// Tidak mengubah baud 9600 atau frekuensi pembaruan GNSS asli.
const size_t BUFFER_GPS_RX_BYTES = 4096;

// Diagnostik UART/NMEA per 10 detik, agar mudah melihat gangguan kabel/data.
const unsigned long INTERVAL_DIAG_GPS_MS = 10000UL;
unsigned long waktuDiagGPSTerakhir = 0;
unsigned long karakterGPSTerakhir = 0;
unsigned long kalimatGPSTerakhir = 0;
unsigned long checksumGagalTerakhir = 0;

// Mengurai GPS di task mandiri mengurangi hilangnya kalimat NMEA ketika
// HTTPS, DNS, atau sinkronisasi NTP menahan loop(). Bukan penguat sinyal satelit.
SemaphoreHandle_t mutexGPS = nullptr;
TaskHandle_t handlePembacaGPS = nullptr;

struct SnapshotGPS {
  bool tersedia = false;
  bool lokasiValid = false;
  double latitude = 0.0;
  double longitude = 0.0;
  unsigned long usiaLokasiMs = 0;
  bool satelitValid = false;
  unsigned long usiaSatelitMs = 0;
  unsigned long satelitDigunakan = 0;
  bool satelitTerdeteksiValid = false;
  unsigned long usiaSatelitTerdeteksiMs = 0;
  char satelitTerdeteksiValue[24] = {0};
  bool hdopValid = false;
  unsigned long usiaHdopMs = 0;
  double hdop = 0.0;
  bool altitudeValid = false;
  unsigned long usiaAltitudeMs = 0;
  double altitudeMeter = 0.0;
  unsigned long chars = 0;
  unsigned long passed = 0;
  unsigned long failed = 0;
};

// HANYA task ini yang memanggil gps.encode(). Snapshot dilindungi mutex.
// Batasi batch untuk memberi kesempatan task Wi-Fi dan proses lain berjalan.
void taskBacaGPS(void *parameter) {
  (void)parameter;
  for (;;) {
    if (xSemaphoreTake(mutexGPS, portMAX_DELAY) == pdTRUE) {
      int jumlahByte = 0;
      while (jumlahByte < 128 && gpsSerial.available() > 0) {
        gps.encode((char)gpsSerial.read());
        jumlahByte++;
      }
      xSemaphoreGive(mutexGPS);
    }
    vTaskDelay(1); // Minimal satu tick RTOS; tidak membebani core Wi-Fi.
  }
}

SnapshotGPS bacaSnapshotGPS() {
  SnapshotGPS s;
  if (mutexGPS == nullptr || xSemaphoreTake(mutexGPS, pdMS_TO_TICKS(100)) != pdTRUE) {
    return s;
  }
  s.tersedia = true;
  s.lokasiValid = gps.location.isValid();
  if (s.lokasiValid) {
    s.latitude = gps.location.lat();
    s.longitude = gps.location.lng();
    s.usiaLokasiMs = gps.location.age();
  }
  s.satelitValid = gps.satellites.isValid();
  if (s.satelitValid) {
    s.usiaSatelitMs = gps.satellites.age();
    s.satelitDigunakan = gps.satellites.value();
  }
  s.satelitTerdeteksiValid = satelitTerdeteksi.isValid();
  if (s.satelitTerdeteksiValid) {
    s.usiaSatelitTerdeteksiMs = satelitTerdeteksi.age();
    strncpy(s.satelitTerdeteksiValue, satelitTerdeteksi.value(),
            sizeof(s.satelitTerdeteksiValue) - 1);
    s.satelitTerdeteksiValue[sizeof(s.satelitTerdeteksiValue) - 1] = '\0';
  }
  s.hdopValid = gps.hdop.isValid();
  if (s.hdopValid) {
    s.usiaHdopMs = gps.hdop.age();
    s.hdop = gps.hdop.hdop();
  }
  s.altitudeValid = gps.altitude.isValid();
  if (s.altitudeValid) {
    s.usiaAltitudeMs = gps.altitude.age();
    s.altitudeMeter = gps.altitude.meters();
  }
  s.chars = gps.charsProcessed();
  s.passed = gps.passedChecksum();
  s.failed = gps.failedChecksum();
  xSemaphoreGive(mutexGPS);
  return s;
}

// AJ-SR04M (pin tidak diubah)
#define TRIG_PIN 18
#define ECHO_PIN 19

// Wi-Fi (isi sendiri, jangan publikasikan kata sandi)
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// ========================================================
// S5-23: POST HTTPS ke Django melalui Cloudflare Tunnel.
// URL trycloudflare bersifat sementara; pastikan tunnel aktif.
// Ganti token di salinan lokal. JANGAN unggah rahasia ke GitHub.
// ========================================================
const char* API_URL_HTTPS = "https://height-perry-prices-settle.trycloudflare.com/api/monitoring/";
const char* DEVICE_TOKEN_UJI = "YOUR_DEVICE_TOKEN";


// ========================================================
// S6-25: identitas unik untuk SATU tong fisik SmartBin.
// Rujukan data master yang sudah diperiksa oleh tim Full Stack:
// device_iot.id_perangkat = ESP32-001 -> tong_sampah.id_tong = 1
// tong_sampah.kode_tong  = SB-F001 (jenis_tong = fisik)
// Delapan tong virtual memakai identitas tersendiri di backend.
// ID_TONG_MASTER dan KODE_TONG_MASTER HANYA untuk pemeriksaan lokal.
// Jangan tambahkan kedua field ke payload tanpa persetujuan kontrak API.
// ========================================================
const char* DEVICE_ID = "ESP32-001";
const int ID_TONG_MASTER = 1;
const char* KODE_TONG_MASTER = "SB-F001";
const char* JENIS_TONG_MASTER = "fisik";

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

// ========================================================
// S6-23 - Kirim monitoring berkala setiap 5 menit.
// Tidak memengaruhi pembacaan ultrasonik / GPS.
// ========================================================
const unsigned long INTERVAL_KIRIM_MS = 300000UL;
unsigned long waktuKirimTerakhir = 0;
unsigned long jumlahPercobaanOtomatis = 0;

// ========================================================
// S6-24 - Pantau Wi-Fi setiap 1 detik dan coba sambung ulang
// setiap 10 detik jika belum terhubung. Tanpa delay()/restart.
// ========================================================
const unsigned long INTERVAL_CEK_WIFI_MS = 1000UL;
const unsigned long INTERVAL_RECONNECT_WIFI_MS = 10000UL;
unsigned long waktuCekWiFiTerakhir = 0;
unsigned long waktuCobaReconnectTerakhir = 0;
unsigned long jumlahPercobaanReconnect = 0;
bool wifiStatusTerakhir = false;
bool wifiPernahTerhubung = false;
bool wifiSudahDilaporkan = false;

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

// Deklarasi eksplisit agar Arduino tidak membuat prototipe otomatis
// sebelum enum StatusJarak dikenal oleh compiler.
StatusJarak cekStatusJarak(float jarak);

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
  payload += "{\"device_id\":\"";
  payload += DEVICE_ID;
  payload += "\",\"distance_cm\":";
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

// S6-25: bukti identitas pada Serial Monitor (perintah D lalu Enter).
// Ini verifikasi KONFIGURASI LOKAL berdasarkan data master yang diberikan,
// bukan query langsung ke Supabase dan bukan bukti monitoring tersimpan.
void tampilkanIdentitasS625() {
  Serial.println();
  Serial.println("===== S6-25: IDENTITAS SMARTBIN =====");
  Serial.print("ID Perangkat : "); Serial.println(DEVICE_ID);
  Serial.print("ID Tong      : "); Serial.println(ID_TONG_MASTER);
  Serial.print("Kode Tong    : "); Serial.println(KODE_TONG_MASTER);
  Serial.print("Jenis Tong   : "); Serial.println(JENIS_TONG_MASTER);
  Serial.println("Sumber       : konfigurasi lokal, cocokkan dengan master Supabase");
  Serial.println("Payload API  : device_id, distance_cm, fill_percent");
  Serial.println("Catatan      : id_tong ditentukan backend, BUKAN dikirim oleh ESP32");
  Serial.println("====================================");
  Serial.println();
}

// ========================================================
// S5-23: Fungsi HTTPS POST ESP32 -> Django via Cloudflare Tunnel.
// Dipanggil saat input P maupun oleh timer S6-23.
// Tidak mengirim jika Wi-Fi putus atau data sensor tidak valid.
// ========================================================
void kirimMonitoringHTTPSManual() {
  Serial.println();
  Serial.println("===== HTTPS POST MONITORING S6-23 =====");
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

// ========================================================
// S6-21: validasi format decimal degrees (uji lokal dahulu).
// Batas: latitude [-90, 90], longitude [-180, 180].
// Jangan menganggap posisi GPS lama sebagai posisi terkini.
// Belum mengubah payload HTTPS: backend masih menyiapkan GPS.
// ========================================================
// Usia <= 5 dtk = pembaruan GPS masih segar.
// Koordinat terakhir tetap ditampilkan jika terlambat, TAPI jelas dilabeli
// sebagai data historis, bukan posisi terkini. Ini bukan memperkuat sinyal RF.
const unsigned long BATAS_USIA_FIX_GPS_MS = 5000UL;
const unsigned long BATAS_TRANSISI_GPS_MS = 30000UL;

bool koordinatDalamRentang(double latitude, double longitude) {
  return isfinite(latitude) && isfinite(longitude) &&
         latitude >= -90.0 && latitude <= 90.0 &&
         longitude >= -180.0 && longitude <= 180.0;
}

bool koordinatGPSSiap() {
  const SnapshotGPS s = bacaSnapshotGPS();
  return s.tersedia && s.lokasiValid &&
         s.usiaLokasiMs < BATAS_USIA_FIX_GPS_MS &&
         koordinatDalamRentang(s.latitude, s.longitude);
}

// G di Serial Monitor: simulasi pengujian fungsi, bukan data GPS fisik.
void ujiValidasiGPSS621() {
  struct KasusKoordinat {
    const char* nama;
    double latitude;
    double longitude;
  };
  const KasusKoordinat kasus[] = {
    {"Dalam rentang", -5.358032, 105.265155},
    {"Latitude > 90", 95.0, 105.265155},
    {"Longitude > 180", -5.358032, 190.0},
    {"Latitude bukan angka", NAN, 105.265155}
  };

  Serial.println();
  Serial.println("===== SIMULASI VALIDASI GPS S6-21 =====");
  Serial.println("HANYA PENGUJIAN FUNGSI; BUKAN GPS FISIK; TIDAK DIKIRIM");
  for (unsigned int i = 0; i < sizeof(kasus) / sizeof(kasus[0]); i++) {
    Serial.print("Kasus         : "); Serial.println(kasus[i].nama);
    if (koordinatDalamRentang(kasus[i].latitude, kasus[i].longitude)) {
      Serial.println("Status GPS    : VALID");
      Serial.println("Format        : DECIMAL DEGREES (JSON number)");
      Serial.print("Contoh JSON   : {\"latitude\":");
      Serial.print(kasus[i].latitude, 6);
      Serial.print(",\"longitude\":");
      Serial.print(kasus[i].longitude, 6);
      Serial.println("}");
    } else {
      Serial.println("Status GPS    : INVALID (rentang/angka tidak sesuai)");
      Serial.println("Koordinat     : TIDAK BOLEH DIGUNAKAN");
    }
    Serial.println("---------------------------------------");
  }
  Serial.println("Payload HTTPS monitoring tetap TANPA field GPS sampai backend siap.");
  Serial.println("=======================================");
  Serial.println();
}

// Baca status FIX hanya dari data NMEA. Jika satelit/antenanya tidak siap,
// kode ini TIDAK mengarang koordinat atau memaksa status VALID.
void tampilkanGps() {
  const SnapshotGPS s = bacaSnapshotGPS();
  if (!s.tersedia) {
    Serial.println("Status GPS    : PEMBACA GPS SEDANG SIBUK");
    return;
  }
  const bool koordinatAda = s.lokasiValid &&
      koordinatDalamRentang(s.latitude, s.longitude);
  const unsigned long usiaMs = koordinatAda ? s.usiaLokasiMs : 0UL;
  const bool posisiSegar = koordinatAda && usiaMs < BATAS_USIA_FIX_GPS_MS;

  if (posisiSegar) {
    Serial.println("Status GPS    : VALID (fix baru, koordinat dalam rentang)");
  } else if (koordinatAda && usiaMs < BATAS_TRANSISI_GPS_MS) {
    Serial.println("Status GPS    : UPDATE TERLAMBAT (menunggu fix terbaru)");
    Serial.println("GPS           : Posisi terakhir, BUKAN posisi live");
  } else if (koordinatAda) {
    Serial.println("Status GPS    : FIX HILANG / BELUM PULIH");
    Serial.println("GPS           : Posisi terakhir tersimpan, BUKAN posisi live");
  } else {
    Serial.println("GPS           : Belum mendapatkan fix valid");
    Serial.println("Status GPS    : KOORDINAT BELUM TERSEDIA");
  }

  if (koordinatAda) {
    Serial.print(posisiSegar ? "Latitude      : " : "Latitude lama : ");
    Serial.println(s.latitude, 6);
    Serial.print(posisiSegar ? "Longitude     : " : "Longitude lama: ");
    Serial.println(s.longitude, 6);
    Serial.print("Usia fix      : ");
    Serial.print(usiaMs / 1000UL);
    Serial.println(" detik");
  }

  if (s.satelitValid && s.usiaSatelitMs < 10000UL) {
    Serial.print("Satelit digunakan  : ");
    Serial.println(s.satelitDigunakan);
  } else {
    Serial.println("Satelit digunakan  : Belum tersedia / data lama");
  }
  if (s.satelitTerdeteksiValid && s.usiaSatelitTerdeteksiMs < 10000UL) {
    Serial.print("Satelit terdeteksi : ");
    Serial.println(s.satelitTerdeteksiValue);
  } else {
    Serial.println("Satelit terdeteksi : Belum tersedia / data lama");
  }
  if (s.hdopValid && s.usiaHdopMs < 10000UL) {
    Serial.print("HDOP GPS      : ");
    Serial.println(s.hdop, 2);
  } else {
    Serial.println("HDOP GPS      : Belum tersedia / data lama");
  }
  if (s.altitudeValid && s.usiaAltitudeMs < 10000UL && posisiSegar) {
    Serial.print("Altitude      : ");
    Serial.print(s.altitudeMeter, 2);
    Serial.println(" meter");
  }
  if (koordinatAda) {
    Serial.print(posisiSegar ? "OpenStreetMap : " : "Peta posisi lama: ");
    Serial.print("https://www.openstreetmap.org/?mlat=");
    Serial.print(s.latitude, 6);
    Serial.print("&mlon=");
    Serial.print(s.longitude, 6);
    Serial.print("#map=18/");
    Serial.print(s.latitude, 6);
    Serial.print("/");
    Serial.println(s.longitude, 6);
  }
}

// Laporkan DELTA tiap 10 detik. Angka total checksum adalah kumulatif.
void pantauKesehatanGPS() {
  const unsigned long sekarang = millis();
  if (sekarang - waktuDiagGPSTerakhir < INTERVAL_DIAG_GPS_MS) return;
  waktuDiagGPSTerakhir = sekarang;

  const SnapshotGPS s = bacaSnapshotGPS();
  if (!s.tersedia) return;
  const unsigned long tambahKarakter = s.chars - karakterGPSTerakhir;
  const unsigned long tambahValid = s.passed - kalimatGPSTerakhir;
  const unsigned long tambahGagal = s.failed - checksumGagalTerakhir;
  karakterGPSTerakhir = s.chars;
  kalimatGPSTerakhir = s.passed;
  checksumGagalTerakhir = s.failed;

  Serial.println("===== DIAGNOSA GPS / 10 DETIK =====");
  Serial.print("Karakter NMEA baru : "); Serial.println(tambahKarakter);
  Serial.print("Kalimat valid baru : "); Serial.println(tambahValid);
  Serial.print("Checksum gagal baru: "); Serial.println(tambahGagal);
  if (tambahKarakter == 0) {
    Serial.println("INDIKASI: ESP32 tidak menerima NMEA; cek TX GPS -> RX2, daya GPS.");
  } else if (tambahValid == 0) {
    Serial.println("INDIKASI: belum ada kalimat valid, periksa UART/baud/kabel.");
  } else if (tambahGagal > tambahValid) {
    Serial.println("CATATAN: checksum gagal dominan; periksa daya, kabel, dan UART.");
  }
  Serial.println("=================================");
}

// ========================================================
// S6-24 - Nonblocking Wi-Fi monitoring + manual retry.
// WiFi.setAutoReconnect(true) dari setup() tetap digunakan.
// ========================================================
void kelolaKoneksiWiFi() {
  const unsigned long sekarang = millis();
  if (sekarang - waktuCekWiFiTerakhir < INTERVAL_CEK_WIFI_MS) return;
  waktuCekWiFiTerakhir = sekarang;

  const bool terhubung = (WiFi.status() == WL_CONNECTED);
  if (terhubung) {
    if (!wifiStatusTerakhir || !wifiSudahDilaporkan) {
      Serial.println();
      Serial.println("===== S6-24: STATUS WI-FI =====");
      if (wifiPernahTerhubung) {
        Serial.println("HASIL       : WI-FI PULIH / TERHUBUNG KEMBALI");
      } else {
        Serial.println("HASIL       : WI-FI TERHUBUNG");
      }
      Serial.print("IP Address  : ");
      Serial.println(WiFi.localIP());
      Serial.println("==============================");
      Serial.println();
      wifiPernahTerhubung = true;
      wifiSudahDilaporkan = true;
    }
    wifiStatusTerakhir = true;
    return;
  }

  if (wifiStatusTerakhir) {
    Serial.println();
    Serial.println("===== S6-24: STATUS WI-FI =====");
    Serial.println("HASIL       : WI-FI TERPUTUS");
    Serial.println("Sensor dan GPS tetap berjalan; POST tidak dikirim saat offline.");
    Serial.println("==============================");
    Serial.println();
    // Beri kesempatan fitur auto-reconnect bawaan bekerja dahulu.
    waktuCobaReconnectTerakhir = sekarang;
  } else if (!wifiSudahDilaporkan) {
    Serial.println("[S6-24] Wi-Fi belum terhubung, menunggu koneksi awal...");
    wifiSudahDilaporkan = true;
  }
  wifiStatusTerakhir = false;

  if (sekarang - waktuCobaReconnectTerakhir >= INTERVAL_RECONNECT_WIFI_MS) {
    waktuCobaReconnectTerakhir = sekarang;
    jumlahPercobaanReconnect++;
    Serial.println();
    Serial.println("===== S6-24: KONEKSI ULANG WI-FI =====");
    Serial.print("Percobaan ke: ");
    Serial.println(jumlahPercobaanReconnect);
    bool dimulai = WiFi.reconnect();
    if (dimulai) {
      Serial.println("Memulai reconnect... (belum berarti berhasil)");
    } else {
      Serial.println("Perintah reconnect tidak dimulai; auto-reconnect tetap aktif.");
    }
    Serial.println("====================================");
    Serial.println();
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  gpsSerial.setRxBufferSize(BUFFER_GPS_RX_BYTES);
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);

  mutexGPS = xSemaphoreCreateMutex();
  if (mutexGPS == nullptr ||
      xTaskCreatePinnedToCore(taskBacaGPS, "GPS_UART2", 4096, nullptr,
                              2, &handlePembacaGPS, 0) != pdPASS) {
    Serial.println("FATAL: gagal menyiapkan pembaca GPS; periksa memori ESP32.");
    while (true) delay(1000);
  }

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
  Serial.println("Baca sensor: 1 detik; POST otomatis: setiap 5 menit");
  Serial.println("S6-24: pemeriksaan Wi-Fi 1 detik, reconnect tiap 10 detik");
  Serial.println("S6-25: tekan D lalu Enter untuk periksa ID perangkat/tong");
  tampilkanIdentitasS625();
  Serial.println("Uji S5-19: V/I/A/T; uji rumus S5-20: K lalu Enter");
  Serial.println("Uji S5-22: tekan J lalu Enter untuk cetak JSON terbaru");
  Serial.println("Uji HTTPS POST: tekan P lalu Enter (manual; TLS diverifikasi)");
  Serial.println("Uji S6-21: tekan G lalu Enter untuk simulasi validasi GPS");
  Serial.println("Uji S6-24: matikan hotspot/router, lalu hidupkan kembali");
  Serial.println("GPS UART2 dibaca di task mandiri, termasuk saat TLS/NTP aktif");
  Serial.println("Diagnosa GPS: baca karakter NMEA/10dtk, HDOP, usia fix, posisi terakhir");
  Serial.println("GPS: 5dtk fix segar; lokasi terakhir diberi label lama bila tidak terbarui");
  Serial.println();
  waktuKirimTerakhir = millis();  // S6-23: percobaan POST pertama +5 menit
}

void loop() {
  // GPS diproses terus di task mandiri; loop() tidak boleh membaca UART2 lagi.
  pantauKesehatanGPS(); // Diagnosis GPS tiap 10 detik, tanpa reset GPS
  kelolaKoneksiWiFi(); // S6-24: monitor & reconnect tanpa blocking

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
    } else if (input == 'D' || input == 'd') {
      tampilkanIdentitasS625();
    } else if (input == 'G' || input == 'g') {
      ujiValidasiGPSS621();
    } else if (input == 'K' || input == 'k') ujiSimulasiKalibrasi();
    else ujiSimulasiS519(input);
  }

  if (millis() - waktuBacaTerakhir >= INTERVAL_BACA_MS) {
    waktuBacaTerakhir = millis();

    float jarakMentah = bacaJarak();
    // Diulang setiap siklus: JSON tidak boleh mewakili data lama.
    dataJsonTersedia = false;
    simpanRiwayat(jarakMentah);

    Serial.println("===== DATA SMARTBIN =====");
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

    const SnapshotGPS statusNMEA = bacaSnapshotGPS();
    if (statusNMEA.tersedia) {
      Serial.print("Data GPS diterima : ");
      Serial.println(statusNMEA.chars);
      Serial.print("Kalimat GPS valid : ");
      Serial.println(statusNMEA.passed);
      Serial.print("Checksum gagal    : ");
      Serial.println(statusNMEA.failed);
    }

    Serial.println("==============================");
    Serial.println();
  }

  // S6-23: pengiriman otomatis setiap 5 menit.
  // Jika Wi-Fi putus, fungsi POST akan melewati pengiriman tersebut.
  // Tidak ada pengiriman susulan instan di luar interval 5 menit.
  if (millis() - waktuKirimTerakhir >= INTERVAL_KIRIM_MS) {
    waktuKirimTerakhir = millis();
    jumlahPercobaanOtomatis++;
    Serial.println();
    Serial.println("===== S6-23: PENGIRIMAN OTOMATIS =====");
    Serial.print("Percobaan ke : ");
    Serial.println(jumlahPercobaanOtomatis);
    Serial.println("Interval    : 300 detik (5 menit)");
    Serial.println("Tanpa input P dari Serial Monitor");
    kirimMonitoringHTTPSManual();
  }
}
