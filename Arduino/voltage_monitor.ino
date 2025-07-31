/*
 * Voltage Monitor for Anomaly Detection
 * Reads voltage from A0 pin and sends data via serial
 * Compatible with WebSocket backend
 */

const int VOLTAGE_PIN = A0;          // Analog pin for voltage reading
const int SAMPLE_RATE = 100;         // Milliseconds between readings
const float VOLTAGE_REFERENCE = 5.0; // Arduino reference voltage
const int ADC_RESOLUTION = 1023;     // 10-bit ADC

void setup()
{
    Serial.begin(9600);
    Serial.println("Voltage Monitor Started");
    Serial.println("Format: voltage,timestamp");
}

void loop()
{
    // Read analog voltage
    int rawValue = analogRead(VOLTAGE_PIN);

    // Convert to voltage (0-5V)
    float voltage = (rawValue * VOLTAGE_REFERENCE) / ADC_RESOLUTION;

    // Get current timestamp (milliseconds since start)
    unsigned long timestamp = millis();

    // Send data in format: voltage,timestamp
    Serial.print(voltage, 3); // 3 decimal places
    Serial.print(",");
    Serial.println(timestamp);

    delay(SAMPLE_RATE);
}