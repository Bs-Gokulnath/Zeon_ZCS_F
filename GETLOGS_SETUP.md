# Get Logs Feature

This feature allows you to download logs from the zeonserver based on selected dates.

## Setup Instructions

### 1. Install Server Dependencies

```bash
cd server
npm install
```

### 2. Configure SSH Credentials

Create a config file from the example:
```bash
cd server
cp config.example.js config.js
```

Edit `server/config.js` and update with your actual credentials:

```javascript
export const SSH_CONFIG = {
  host: 'zeonserver',  // or IP address
  port: 22,
  username: 'zeon',
  password: 'YOUR_ACTUAL_PASSWORD',  // Replace this
};
```

**Security Note:** The `config.js` file is gitignored to protect your credentials.

### 3. Start the Backend Server

```bash
cd server
npm start
```

The server will run on `http://localhost:3001`

### 4. Start the Frontend (in a new terminal)

```bash
npm run dev
```

### 5. Access the Feature

Navigate to `http://localhost:5173/getlogs` in your browser.

## How to Use

1. Click on the date input field to open the calendar
2. Select a single date for logs from that day only
3. Or select a date range by clicking start date, then end date
4. Click "Fetch Data" to download
5. Logs will be downloaded as a ZIP file to your computer

## Directory Structure

Logs are retrieved from:
```
/home/zeon/Zeon_automation/ocpplog/processed/{year}/{month}/{day}/
```

## Troubleshooting

### Server won't start
- Make sure you've created `server/config.js` from `server/config.example.js`
- Check that your SSH credentials are correct
- Verify the server address is reachable

### Can't download logs
- Ensure the backend server is running on port 3001
- Check browser console for errors
- Verify the date you selected has logs on the server

### SSH connection fails
- Verify your SSH credentials in `server/config.js`
- Check if you can manually SSH to the server: `ssh zeon@zeonserver`
- Ensure port 22 is open and accessible
