import express from 'express';
import cors from 'cors';
import { Client } from 'ssh2';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import { SSH_CONFIG, BASE_LOG_PATH } from './config.js';

const app = express();
const PORT = 3001;

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
  const { startDate, endDate } = req.body;

  if (!startDate) {
    return res.status(400).json({ error: 'Start date is required' });
  }

  try {
    const conn = new Client();
    const dates = getDateRange(startDate, endDate || startDate);

    conn.on('ready', () => {
      console.log('SSH connection established');

      // Create archive
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      // Set response headers
      res.attachment(`logs_${startDate.year}-${startDate.month}-${startDate.day}_to_${(endDate || startDate).year}-${(endDate || startDate).month}-${(endDate || startDate).day}.zip`);
      res.setHeader('Content-Type', 'application/zip');

      // Pipe archive to response
      archive.pipe(res);

      // Track completion
      let processedDates = 0;
      let hasFiles = false;

      // Process each date
      const processDate = (dateIndex) => {
        if (dateIndex >= dates.length) {
          // All dates processed
          if (!hasFiles) {
            archive.abort();
            conn.end();
            return res.status(404).json({ error: 'No log files found for the selected date(s)' });
          }
          
          archive.finalize();
          conn.end();
          return;
        }

        const date = dates[dateIndex];
        const logPath = `${BASE_LOG_PATH}/${date.year}/${date.month}/${date.day}`;

        console.log(`Processing: ${logPath}`);

        conn.sftp((err, sftp) => {
          if (err) {
            console.error('SFTP error:', err);
            processDate(dateIndex + 1);
            return;
          }

          // Check if directory exists
          sftp.readdir(logPath, (err, fileList) => {
            if (err) {
              console.log(`Directory not found: ${logPath}`);
              processDate(dateIndex + 1);
              return;
            }

            if (fileList.length === 0) {
              console.log(`No files in: ${logPath}`);
              processDate(dateIndex + 1);
              return;
            }

            // Process all files in the directory
            let filesProcessed = 0;
            const totalFiles = fileList.filter(file => file.attrs.isFile()).length;

            if (totalFiles === 0) {
              processDate(dateIndex + 1);
              return;
            }

            fileList.forEach((file) => {
              if (!file.attrs.isFile()) {
                return;
              }

              hasFiles = true;
              const remoteFilePath = `${logPath}/${file.filename}`;
              const archivePath = `${date.year}/${date.month}/${date.day}/${file.filename}`;

              console.log(`Adding file: ${archivePath}`);

              // Create a stream for this file
              const fileStream = sftp.createReadStream(remoteFilePath);
              
              archive.append(fileStream, { name: archivePath });

              fileStream.on('end', () => {
                filesProcessed++;
                if (filesProcessed === totalFiles) {
                  processDate(dateIndex + 1);
                }
              });

              fileStream.on('error', (err) => {
                console.error(`Error reading file ${remoteFilePath}:`, err);
                filesProcessed++;
                if (filesProcessed === totalFiles) {
                  processDate(dateIndex + 1);
                }
              });
            });
          });
        });
      };

      // Start processing
      processDate(0);
    });

    conn.on('error', (err) => {
      console.error('SSH connection error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'SSH connection failed: ' + err.message });
      }
    });

    // Connect to SSH server
    conn.connect(SSH_CONFIG);

  } catch (error) {
    console.error('Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Log server is running' });
});

app.listen(PORT, () => {
  console.log(`Log download server running on http://localhost:${PORT}`);
  console.log('Make sure to update SSH_CONFIG with your server credentials');
});
