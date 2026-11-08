#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <math.h>

// ===================================
// GPS NEO-6M - PIN TETAP
// ===================================
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
TinyGPSCustom satelitTerdeteksi(gps, "GPGSV", 3);

#define GPS_RX 22
#define GPS_TX 23

// ===================================
// AJ-SR04M - PIN TETAP
// ===================================
#define TRIG_PIN 18
#define ECHO_PIN 19

// S5-19: hasil kesepakatan pengukuran fisik SmartBin.
// Tinggi sensor ke dasar tong saat kosong: 55 cm (penggaris).
// Margin toleransi yang disepakati tim: 2 cm.
const float TINGGI_TONG_CM = 55.0f;
const float MARGIN_CM = 2.0f;
const float JARAK_MAX_VALID_CM = TINGGI_TONG_CM + MARGIN_CM; // 57 cm
// Batas minimum sementara: cek kembali spesifikasi varian AJ-SR04M.
const float JARAK_MIN_VALID_CM = 20.0f;

// ===================================
// Wi-Fi - KONFIGURASI TETAP
// ===================================
const char* ssid = "NAMA_WIFI";
const char* password = "PASSWORD_WIFI";

// Interval tampil data
unsigned long previousMillis = 0;
const unsigned long interval = 1000;

// ===================================
// S5-19: STATUS PEMBACAAN
// ===================================
enum StatusJarak {
  SENSOR_VALID,
  SENSOR_TIMEOUT,
  SENSOR_INVALID
};

// Logika validasi terpisah agar mudah diuji dengan simulasi.
StatusJarak cekStatusJarak(float jarak) {
  if (jarak == -1.0f) {
    return SENSOR_TIMEOUT;
  }

  if (!isfinite(jarak) ||
      jarak < JARAK_MIN_VALID_CM ||
      jarak > JARAK_MAX_VALID_CM) {
    return SENSOR_INVALID;
  }

  return SENSOR_VALID;
}

// ===================================
// Fungsi asli pembacaan ultrasonik
// ===================================
float bacaJarak() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  long durasi = pulseIn(ECHO_PIN, HIGH, 30000);

  if (durasi == 0) {
    return -1.0f;  // Tidak ada pantulan hingga timeout.
  }

  float jarak = durasi * 0.0343f / 2.0f;
  return jarak;
}

// ===================================
// S5-19: tampilan hasil & status
// ===================================
void tampilkanHasilJarak(float jarak) {
  StatusJarak status = cekStatusJarak(jarak);

  if (status == SENSOR_TIMEOUT) {
    Serial.println("Jarak Sampah : Tidak terbaca");
    Serial.println("Status Sensor: TIMEOUT");
  } else if (status == SENSOR_INVALID) {
    Serial.print("Jarak Sampah : ");
    Serial.print(jarak, 1);
    Serial.println(" cm (di luar batas)");
    Serial.println("Status Sensor: INVALID");
  } else {
    Serial.print("Jarak Sampah : ");
    Serial.print(jarak, 1);
    Serial.println(" cm");
    Serial.println("Status Sensor: VALID");
  }
}

// ===================================
// S5-19: pengujian logika tanpa
// melepaskan sensor dari tong.
// V / T / I / A hanya SIMULASI,
// bukan pembacaan perangkat fisik.
// ===================================
void ujiSimulasi(char perintah) {
  float nilaiUji;

  switch (perintah) {
    case 'V':
    case 'v':
      nilaiUji = 35.0f;
      break;
    case 'T':
    case 't':
      nilaiUji = -1.0f;
      break;
    case 'I':
    case 'i':
      nilaiUji = 10.0f;
      break;
    case 'A':
    case 'a':
      nilaiUji = 100.0f;
      break;
    default:
      return;  // Abaikan Enter, newline, karakter lain.
  }

  Serial.println();
  Serial.println("=== UJI LOGIKA S5-19 (SIMULASI) ===");
  Serial.println("BUKAN HASIL SENSOR FISIK");
  tampilkanHasilJarak(nilaiUji);
  Serial.println("===================================");
  Serial.println();
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
  Serial.println("==============================");
  Serial.println("       SMARTBIN TEST");
  Serial.println(" AJ-SR04M + GPS NEO-6M");
  Serial.println("==============================");
  Serial.println("S5-19: Validasi jarak sensor");
  Serial.print("Tinggi sensor ke dasar tong : ");
  Serial.print(TINGGI_TONG_CM, 1);
  Serial.println(" cm (manual)");
  Serial.print("Margin pengukuran          : ");
  Serial.print(MARGIN_CM, 1);
  Serial.println(" cm");
  Serial.print("Batas validasi jarak       : ");
  Serial.print(JARAK_MIN_VALID_CM, 1);
  Serial.print(" - ");
  Serial.print(JARAK_MAX_VALID_CM, 1);
  Serial.println(" cm");
  Serial.println("Ketik V, T, I, A lalu Enter");
  Serial.println("untuk uji logika (SIMULASI).");
  Serial.println();
}

void loop() {
  // Input pengujian manual dari Serial Monitor.
  while (Serial.available() > 0) {
    ujiSimulasi((char)Serial.read());
  }

  // GPS terus dibaca seperti kode sebelumnya.
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  if (millis() - previousMillis >= interval) {
    previousMillis = millis();

    Serial.println("===== DATA SMARTBIN =====");

    // Status Wi-Fi tetap sama.
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Wi-Fi        : TERHUBUNG");
      Serial.print("IP Address   : ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("Wi-Fi        : BELUM TERHUBUNG");
    }

    // Hanya bagian ini yang kini punya validasi.
    float jarak = bacaJarak();
    tampilkanHasilJarak(jarak);

    // GPS dan OpenStreetMap tetap ditampilkan.
    if (gps.location.isValid()) {
      Serial.print("Latitude     : ");
      Serial.println(gps.location.lat(), 6);

      Serial.print("Longitude    : ");
      Serial.println(gps.location.lng(), 6);

      if (gps.satellites.isValid() &&
          gps.satellites.age() < 5000) {
        Serial.print("Satelit digunakan  : ");
        Serial.println(gps.satellites.value());
      } else {
        Serial.println("Satelit digunakan  : Belum tersedia");
      }

      if (satelitTerdeteksi.isValid() &&
          satelitTerdeteksi.age() < 5000) {
        Serial.print("Satelit terdeteksi : ");
        Serial.println(satelitTerdeteksi.value());
      } else {
        Serial.println("Satelit terdeteksi : Belum tersedia");
      }

      if (gps.altitude.isValid()) {
        Serial.print("Altitude     : ");
        Serial.print(gps.altitude.meters(), 2);
        Serial.println(" meter");
      }

      Serial.print("OpenStreetMap: ");
      Serial.print("https://www.openstreetmap.org/?mlat=");
      Serial.print(gps.location.lat(), 6);
      Serial.print("&mlon=");
      Serial.print(gps.location.lng(), 6);
      Serial.print("#map=18/");
      Serial.print(gps.location.lat(), 6);
      Serial.print("/");
      Serial.println(gps.location.lng(), 6);
    } else {
      Serial.println("GPS          : Belum mendapatkan fix");
    }

    Serial.println("=========================");
    Serial.println();
  }
}
