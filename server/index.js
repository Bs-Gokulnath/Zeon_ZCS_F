import express from 'express';
import cors from 'cors';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import { BASE_LOG_PATH } from './config.js';

const app = express();
const PORT = 3000;

// MongoDB connection
const MONGO_URL = 'mongodb://192.168.2.11:27017';
const DB_NAME = 'zeon_db';
let db = null;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    const client = await MongoClient.connect(MONGO_URL);
    db = client.db(DB_NAME);
    console.log('Connected to MongoDB successfully');
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    return null;
  }
}

// Initialize MongoDB connection
connectToMongoDB();

// Enable CORS for all origins
app.use(cors());

// Enable JSON body parser
app.use(express.json());

// Helper function to get date range
function getDateRange(startDate, endDate) {
  const dates = [];
  const currentDate = new Date(
    parseInt(startDate.year),
    parseInt(startDate.month) - 1,
    parseInt(startDate.day)
  );
  const end = new Date(
    parseInt(endDate.year),
    parseInt(endDate.month) - 1,
    parseInt(endDate.day)
  );

  while (currentDate <= end) {
    dates.push({
      year: currentDate.getFullYear().toString(),
      month: String(currentDate.getMonth() + 1).padStart(2, '0'),
      day: String(currentDate.getDate()).padStart(2, '0')
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

// API endpoint to download logs
app.post('/api/logs/download', async (req, res) => {
  const { startDate, endDate, cpid, stationName } = req.body;

  if (!startDate) {
    return res.status(400).json({ error: 'Start date is required' });
  }

  try {
    const dates = getDateRange(startDate, endDate || startDate);
    
    // Normalize CPID - remove 'ocpp_' prefix if present and trim
    let normalizedCpids = [];
    
    if (stationName && db) {
      // Fetch all CPIDs for the given station name
      try {
        const cpDetails = await db.collection('cp_details').find({
          $or: [
            { 'Location name/Station name': { $regex: stationName, $options: 'i' } },
            { 'Station Alias Name': { $regex: stationName, $options: 'i' } }
          ]
        }).toArray();
        
        normalizedCpids = cpDetails.map(doc => {
          const cpidValue = doc['Charge Point id'] || doc['Charge Point ID'] || doc['cpid'];
          return String(cpidValue).replace(/^ocpp_/i, '');
        }).filter(Boolean);
        
        if (normalizedCpids.length === 0) {
          return res.status(404).json({ error: `No charge points found for station: ${stationName}` });
        }
        
        console.log(`Found ${normalizedCpids.length} CPIDs for station "${stationName}":`, normalizedCpids);
      } catch (mongoError) {
        console.error('MongoDB query error:', mongoError);
        return res.status(500).json({ error: 'Failed to fetch station data' });
      }
    } else if (cpid) {
      normalizedCpids = [cpid.trim().replace(/^ocpp_/i, '')];
      console.log(`Filtering logs for CPID: ${normalizedCpids[0]}`);
    }
    
    // Create archive
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    // Set response headers
    const filterSuffix = stationName 
      ? `_${stationName.replace(/[^a-zA-Z0-9]/g, '_')}` 
      : (normalizedCpids.length > 0 ? `_${normalizedCpids[0]}` : '');
    res.attachment(`logs${filterSuffix}_${startDate.year}-${startDate.month}-${startDate.day}_to_${(endDate || startDate).year}-${(endDate || startDate).month}-${(endDate || startDate).day}.zip`);
    res.setHeader('Content-Type', 'application/zip');

    // Pipe archive to response
    archive.pipe(res);

    let hasFiles = false;

    // Process each date
    for (const date of dates) {
      const logPath = path.join(BASE_LOG_PATH, date.year, date.month, date.day);
      
      console.log(`Processing: ${logPath}`);

      // Check if directory exists
      if (!fs.existsSync(logPath)) {
        console.log(`Directory not found: ${logPath}`);
        continue;
      }

      // Read directory
      const files = fs.readdirSync(logPath);
      
      if (files.length === 0) {
        console.log(`No files in: ${logPath}`);
        continue;
      }

      // Add each file to the archive (with CPID filtering if applicable)
      for (const filename of files) {
        // Filter by CPIDs if provided
        if (normalizedCpids.length > 0) {
          // Match pattern: ocpp_{cpid}_{date}.csv for any of the CPIDs
          const matchesAnyCpid = normalizedCpids.some(cpidToMatch => {
            const cpidPattern = new RegExp(`^ocpp_${cpidToMatch}_.*\\.csv$`, 'i');
            return cpidPattern.test(filename);
          });
          
          if (!matchesAnyCpid) {
            continue; // Skip files that don't match any CPID
          }
        }
        
        const filePath = path.join(logPath, filename);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          hasFiles = true;
          // Add files directly to root of ZIP (no nested folders)
          console.log(`Adding file: ${filename}`);
          
          archive.file(filePath, { name: filename });
        }
      }
    }

    if (!hasFiles) {
      archive.abort();
      const errorMsg = stationName
        ? `No log files found for station "${stationName}" in the selected date(s)`
        : normalizedCpids.length > 0
        ? `No log files found for CPID ${normalizedCpids[0]} in the selected date(s)`
        : 'No log files found for the selected date(s)';
      return res.status(404).json({ error: errorMsg });
    }

    // Finalize the archive
    archive.finalize();

  } catch (error) {
    console.error('Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Zeon Log Server API',
    version: '1.0.0',
    endpoints: {
      'GET /': 'This page',
      'GET /api/health': 'Health check',
      'GET /api/stations': 'Get all station names',
      'POST /api/logs/download': 'Download logs (requires startDate, endDate, optional: cpid or stationName)'
    }
  });
});

// Get all unique station names from MongoDB
app.get('/api/stations', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const cpDetails = await db.collection('cp_details').find({}).toArray();
    
    // Extract unique station names
    const stationNames = new Set();
    cpDetails.forEach(doc => {
      const stationName = doc['Location name/Station name'] || doc['Station Alias Name'];
      if (stationName) {
        stationNames.add(stationName.trim());
      }
    });

    const sortedStations = Array.from(stationNames).sort();
    
    res.json({ 
      stations: sortedStations,
      count: sortedStations.length 
    });
  } catch (error) {
    console.error('Error fetching stations:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Log server is running' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Log download server running on http://0.0.0.0:${PORT}`);
  console.log(`Access from network: http://192.168.2.11:${PORT}`);
  console.log('Logs path: ${BASE_LOG_PATH}');
});
