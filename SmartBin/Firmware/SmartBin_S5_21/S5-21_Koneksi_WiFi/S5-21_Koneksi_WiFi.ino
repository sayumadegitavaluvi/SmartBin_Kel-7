
#include <TinyGPSPlus.h>
#include <WiFi.h>

// ===============================
// GPS NEO-6M
// ===============================
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

// Tambahan: jumlah satelit terdeteksi
TinyGPSCustom satelitTerdeteksi(gps, "GPGSV", 3);

#define GPS_RX 22
#define GPS_TX 23

// ===============================
// AJ-SR04M
// ===============================
#define TRIG_PIN 18
#define ECHO_PIN 19

// ===============================
// Wi-Fi - S5-21 / ESP-07
// ===============================
const char* ssid = "ISI_NAMA_WIFI";
const char* password = "ISI_PASSWORD_WIFI";

// Interval tampil data
unsigned long previousMillis = 0;
const unsigned long interval = 1000;

// ===============================
// Fungsi membaca jarak ultrasonik
// ===============================
float bacaJarak() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  // Timeout 30 ms
  long durasi = pulseIn(ECHO_PIN, HIGH, 30000);

  if (durasi == 0) {
    return -1;
  }

  float jarak = durasi * 0.0343 / 2.0;
  return jarak;
}

// ===============================
// SETUP
// ===============================
void setup() {
  Serial.begin(115200);

  // Ultrasonik
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // GPS
  gpsSerial.begin(
    9600,
    SERIAL_8N1,
    GPS_RX,
    GPS_TX
  );

  // Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid, password);

  Serial.println();
  Serial.println("==============================");
  Serial.println("       SMARTBIN TEST");
  Serial.println(" AJ-SR04M + GPS NEO-6M");
  Serial.println("==============================");
  Serial.println();
}

// ===============================
// LOOP
// ===============================
void loop() {

  // GPS harus terus dibaca
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Tampilkan data setiap 1 detik
  if (millis() - previousMillis >= interval) {
    previousMillis = millis();

    Serial.println("===== DATA SMARTBIN =====");

    // =============================
    // STATUS WI-FI
    // =============================
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Wi-Fi        : TERHUBUNG");

      Serial.print("IP Address   : ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("Wi-Fi        : BELUM TERHUBUNG");
    }

    // =============================
    // DATA ULTRASONIK
    // =============================
    float jarak = bacaJarak();

    if (jarak > 0) {
      Serial.print("Jarak Sampah : ");
      Serial.print(jarak, 1);
      Serial.println(" cm");
    } else {
      Serial.println("Jarak Sampah : Tidak terbaca");
    }

    // =============================
    // DATA GPS
    // =============================
    if (gps.location.isValid()) {

      Serial.print("Latitude     : ");
      Serial.println(gps.location.lat(), 6);

      Serial.print("Longitude    : ");
      Serial.println(gps.location.lng(), 6);

      // Satelit yang digunakan
      if (gps.satellites.isValid() &&
          gps.satellites.age() < 5000) {
        Serial.print("Satelit digunakan  : ");
        Serial.println(gps.satellites.value());
      } else {
        Serial.println("Satelit digunakan  : Belum tersedia");
      }

      // Satelit yang terdeteksi
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

      // Link OpenStreetMap
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
