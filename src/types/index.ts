export interface SensorData {
  temperature: number;
  humidity: number;
  sensorReading: number;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  timestamp: number;
  sensorId: string;
}