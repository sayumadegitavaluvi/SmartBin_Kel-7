#define TRIG_PIN 18
#define ECHO_PIN 19

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  digitalWrite(TRIG_PIN, LOW);

  Serial.println();
  Serial.println("=================================");
  Serial.println(" TEST SENSOR ULTRASONIK SMARTBIN ");
  Serial.println(" ESP32 + AJ-SR04M");
  Serial.println(" TRIG = GPIO 18");
  Serial.println(" ECHO = GPIO 19");
  Serial.println("=================================");
}

void loop() {
  // Pastikan Trigger LOW terlebih dahulu
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(5);

  // Kirim pulsa trigger selama 10 mikrodetik
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Baca durasi sinyal Echo
  // Timeout 30.000 us = 30 ms
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    Serial.println("Tidak ada Echo / sensor tidak membaca objek");
  } 
  else {
    // Hitung jarak dalam cm
    float jarakCm = (duration * 0.0343) / 2.0;

    Serial.print("Jarak: ");
    Serial.print(jarakCm, 1);
    Serial.println(" cm");
  }

  delay(1000);
}