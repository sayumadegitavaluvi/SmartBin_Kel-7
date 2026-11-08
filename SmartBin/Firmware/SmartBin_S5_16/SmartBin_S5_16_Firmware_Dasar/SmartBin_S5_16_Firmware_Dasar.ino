void setup() {
  Serial.begin(115200);
  Serial.println("SmartBin ESP32 berhasil dijalankan");
}

void loop() {
  Serial.println("Firmware SmartBin aktif");
  delay(1000);
}