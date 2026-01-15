/**
 * Environment configuration
 *
 * Update the API_URL based on your environment:
 * - Android Emulator: http://178.156.157.159:3000/api
 * - iOS Simulator: http://localhost:3000/api
 * - Physical Device: http://YOUR_COMPUTER_IP:3000/api (e.g., http://192.168.1.100:3000/api)
 * - Production: https://your-domain.com/api
 */

// Default configuration
export const config = {
  // Change this based on your setup
  API_URL: 'http://178.156.157.159:3001/api', // Backend API on port 3001

  // Uncomment the appropriate one for your environment:
  // API_URL: 'http://localhost:3001/api', // iOS simulator
  // API_URL: 'http://178.156.157.159:3001/api', // Physical device (replace with your IP)
  // API_URL: 'https://api.daycareplanner.com/api', // Production
};

// Helper to get your computer's IP address:
// Mac/Linux: Run 'ifconfig | grep "inet "' in terminal
// Windows: Run 'ipconfig' in command prompt
