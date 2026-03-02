# Log Download Server

This backend server handles SSH connections to zeonserver and downloads logs.

## Setup

1. Install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Create configuration file:
   ```bash
   cp config.example.js config.js
   ```

3. Edit `config.js` and update with your SSH credentials:
   - Update `host` (server address or IP)
   - Update `username` 
   - Update `password` or use SSH key

4. Start the server:
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

The server will run on `http://localhost:3001`

## API Endpoints

### POST /api/logs/download
Download logs for a specific date or date range.

**Request Body:**
```json
{
  "startDate": {
    "year": "2026",
    "month": "02",
    "day": "22"
  },
  "endDate": {
    "year": "2026",
    "month": "02",
    "day": "25"
  }
}
```

**Response:** ZIP file download

### GET /api/health
Health check endpoint to verify server is running.
