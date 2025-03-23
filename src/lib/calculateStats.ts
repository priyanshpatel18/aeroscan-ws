import { SensorData } from "../types";

export function calculateStatistics(sensorReadings: SensorData[]) {
  if (sensorReadings.length === 0) {
    return {
      minTemp: null,
      maxTemp: null,
      avgTemp: null,
      minHumidity: null,
      maxHumidity: null,
      avgHumidity: null,
      minSensorReading: null,
      maxSensorReading: null,
      avgSensorReading: null,
      dataPoints: 0,
    };
  }

  let minTemp = Infinity, maxTemp = -Infinity, totalTemp = 0;
  let minHumidity = Infinity, maxHumidity = -Infinity, totalHumidity = 0;
  let minSensorReading = Infinity, maxSensorReading = -Infinity, totalSensorReading = 0;

  sensorReadings.forEach((reading) => {
    minTemp = Math.min(minTemp, reading.temperature);
    maxTemp = Math.max(maxTemp, reading.temperature);
    totalTemp += reading.temperature;

    minHumidity = Math.min(minHumidity, reading.humidity);
    maxHumidity = Math.max(maxHumidity, reading.humidity);
    totalHumidity += reading.humidity;

    minSensorReading = Math.min(minSensorReading, reading.sensorReading);
    maxSensorReading = Math.max(maxSensorReading, reading.sensorReading);
    totalSensorReading += reading.sensorReading;
  });

  const dataPoints = sensorReadings.length;
  return {
    minTemp,
    maxTemp,
    avgTemp: parseFloat((totalTemp / dataPoints).toFixed(2)),
    minHumidity,
    maxHumidity,
    avgHumidity: parseFloat((totalHumidity / dataPoints).toFixed(2)),
    minSensorReading,
    maxSensorReading,
    avgSensorReading: parseFloat((totalSensorReading / dataPoints).toFixed(2)),
    dataPoints,
  };
}