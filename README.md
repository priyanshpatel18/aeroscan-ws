# aeroscan-ws

A real-time air quality monitoring WebSocket server that connects microcontrollers and clients for environmental data collection and broadcasting.

## Features

- Real-time WebSocket communication between microcontrollers and web clients
- Air Quality Index (AQI) calculation for PM2.5 and PM10 particles
- Temperature and humidity monitoring
- Solana blockchain integration for data persistence
- PostgreSQL database storage via Prisma ORM
- Heartbeat mechanism for connection monitoring

## Architecture

The server operates as a bridge between:
- **Microcontrollers**: Send sensor readings (temperature, humidity, PM2.5, PM10)
- **Web Clients**: Receive real-time environmental data updates
- **Solana Network**: Store readings on-chain for transparency
- **PostgreSQL**: Local database for query performance

## Prerequisites

- Node.js 16+
- PostgreSQL database
- Solana wallet with funded account
- Environment variables configured

## Environment Variables

Create a `.env` file with the following variables:

```env
PORT=3000
DATABASE_URL="postgresql://username:password@localhost:5432/aeroscan"
PRIVATE_KEY="your_solana_private_key_base58"
MC_TOKEN="your_microcontroller_auth_token"
HELIUS_RPC_URL="https://api.devnet.solana.com"
```

## Installation

```bash
# Install dependencies
npm install

# Setup database
npx prisma migrate dev
npx prisma generate

# Start server
npm start
```

## WebSocket Connection

### Client Connection
```javascript
const ws = new WebSocket('ws://localhost:3000');
```

### Microcontroller Connection
```javascript
const ws = new WebSocket('ws://localhost:3000?token=your_mc_token');
```

## Message Types

### From Client
```json
{
  "type": "CONNECTED",
  "payload": null
}
```

### From Microcontroller
```json
{
  "type": "UPDATE_DATA",
  "payload": {
    "temperature": 25.5,
    "humidity": 60.2,
    "pm25": 12.3,
    "pm10": 18.7
  }
}
```

### Server Responses
```json
{
  "type": "WELCOME",
  "payload": "Welcome to aeroscan!!"
}

{
  "type": "UPDATE_DATA",
  "payload": {
    "temperature": 25.5,
    "humidity": 60.2,
    "pm25": 12.3,
    "pm10": 18.7,
    "aqi": 45
  }
}

{
  "type": "HEARTBEAT",
  "payload": null
}
```

## AQI Calculation

The server calculates Air Quality Index using EPA standards:

### PM2.5 Breakpoints
- 0-12 μg/m³ → AQI 0-50 (Good)
- 12.1-35.4 μg/m³ → AQI 51-100 (Moderate)
- 35.5-55.4 μg/m³ → AQI 101-150 (Unhealthy for Sensitive Groups)
- 55.5-150.4 μg/m³ → AQI 151-200 (Unhealthy)
- 150.5-250.4 μg/m³ → AQI 201-300 (Very Unhealthy)
- 250.5+ μg/m³ → AQI 301+ (Hazardous)

### PM10 Breakpoints
- 0-54 μg/m³ → AQI 0-50 (Good)
- 55-154 μg/m³ → AQI 51-100 (Moderate)
- 155-254 μg/m³ → AQI 101-150 (Unhealthy for Sensitive Groups)
- 255+ μg/m³ → AQI 151+ (Unhealthy+)

## Database Schema

```sql
model SensorReading {
  id          String   @id @default(cuid())
  pm25        Float?
  pm10        Float?
  temperature Float?
  humidity    Float?
  aqi         Int?
  createdAt   DateTime @default(now())
}
```

## Solana Integration

- Program ID: `D5r3dMspUTkZiHDF3ZUQvD4dmATd1gjXHbzBdTtn7yU5`
- Uses Anchor framework for type-safe interactions
- Stores sensor readings on-chain with event emission
- Dual RPC setup: Standard Solana + Magicblock for optimized performance

## API Endpoints

### POST /
Health check endpoint
- **Response**: `200 OK`

### POST /api/sensor-data
Fallback API endpoint for microcontrollers to send sensor data when WebSocket connection is unavailable.

**Authentication**: Header-based token validation
```bash
# Using Authorization header
curl -X POST http://localhost:3000/api/sensor-data \
  -H "Authorization: Bearer your_mc_token" \
  -H "Content-Type: application/json" \
  -d '{"temperature": 25.5, "humidity": 60.2, "pm25": 12.3, "pm10": 18.7}'

# Using custom header
curl -X POST http://localhost:3000/api/sensor-data \
  -H "x-api-token: your_mc_token" \
  -H "Content-Type: application/json" \
  -d '{"temperature": 25.5, "humidity": 60.2, "pm25": 12.3, "pm10": 18.7}'
```

**Request Body**:
```json
{
  "temperature": 25.5,
  "humidity": 60.2,
  "pm25": 12.3,
  "pm10": 18.7
}
```

**Response**:
```json
{
  "success": true,
  "message": "Sensor data updated successfully",
  "data": {
    "temperature": 25.5,
    "humidity": 60.2
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `400 Bad Request`: Invalid data format
- `500 Internal Server Error`: Server processing error

## Connection Management

- **Heartbeat**: Server pings clients every 5 seconds
- **Auto-cleanup**: Removes disconnected users automatically
- **Connection tracking**: Monitors last active timestamp

## Development

```bash
# Watch mode
npm run dev

# Database operations
npx prisma studio          # Database GUI
npx prisma db push         # Push schema changes
npx prisma generate        # Regenerate client
```

## Security

- Token-based authentication for microcontrollers
- CORS enabled for web client access
- Input validation on sensor data
- Error handling for malformed messages

## Error Handling

The server handles:
- Invalid JSON messages
- Unknown message types
- Solana transaction failures
- Database connection issues
- WebSocket disconnections

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[MIT License](LICENSE) - see LICENSE file for details