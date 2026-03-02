# SSH Server Configuration
# Copy this file to config.js and update with your actual credentials

export const SSH_CONFIG = {
  host: 'zeonserver',  // or use IP address like '192.168.1.100'
  port: 22226,
  username: 'zeon',
  password: 'Zeon@2026',  // Replace with actual password
  
  // Or use SSH key instead of password (recommended):
  // privateKey: require('fs').readFileSync('/path/to/your/private/key'),
  // passphrase: 'your_key_passphrase_if_any'
};

export const BASE_LOG_PATH = '/home/zeon/Zeon_automation/ocpplog/processed';
