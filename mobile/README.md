# Daycare Planner Mobile App

React Native mobile application built with Expo for the Daycare Planner system.

## Features

- 🔐 **Authentication**: Login and register with role-based access
- 👥 **Parent Dashboard**: View children, applications, and daycare choices
- ⚙️ **Admin Dashboard**: Manage users, daycares, and view system statistics
- 🎨 **Modern UI**: Clean, intuitive interface with native feel
- 📱 **Cross-Platform**: Works on iOS, Android, and Web

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- For iOS: Mac with Xcode
- For Android: Android Studio with emulator

## Installation

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

## Running the App

### Option 1: Expo Go (Recommended for testing)

1. Install **Expo Go** on your phone:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Start the development server:
   ```bash
   npm start
   ```

3. Scan the QR code with your phone camera (iOS) or Expo Go app (Android)

### Option 2: iOS Simulator

```bash
npm run ios
```

### Option 3: Android Emulator

```bash
npm run android
```

### Option 4: Web Browser

```bash
npm run web
```

## Backend Configuration

The app connects to the backend API. Update the API URL in `/src/api/client.ts`:

```typescript
// For Android Emulator
const API_URL = 'http://10.0.2.2:3000/api';

// For iOS Simulator
const API_URL = 'http://localhost:3000/api';

// For Physical Device (use your computer's IP)
const API_URL = 'http://192.168.x.x:3000/api';

// For Production
const API_URL = 'https://your-domain.com/api';
```

### Finding Your Computer's IP Address:

**Mac/Linux:**
```bash
ifconfig | grep "inet "
```

**Windows:**
```bash
ipconfig
```

## Project Structure

```
mobile/
├── App.tsx                 # Main app component
├── src/
│   ├── api/               # API client configuration
│   ├── components/        # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Card.tsx
│   ├── contexts/          # React contexts
│   │   └── AuthContext.tsx
│   ├── navigation/        # Navigation configuration
│   │   └── index.tsx
│   ├── screens/           # App screens
│   │   ├── LandingScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── ParentDashboardScreen.tsx
│   │   └── AdminDashboardScreen.tsx
│   └── types/             # TypeScript types
│       └── index.ts
├── assets/                # Images and static files
└── package.json
```

## Available Screens

### Authentication
- **Landing Page**: Marketing and app information
- **Login**: User authentication
- **Register**: New user registration

### Parent Role
- **Parent Dashboard**:
  - View and manage children
  - Create and track applications
  - See application status across all daycare choices
  - Opt-in to parent network

### System Admin Role
- **Admin Dashboard**:
  - System overview with statistics
  - User management
  - Daycare management
  - View all applications

## User Roles

The app supports multiple user types:

1. **Parent**: Manage children and applications
2. **Daycare Admin**: Manage daycare waitlists (future)
3. **Funder**: View anonymized reports (future)
4. **System Admin**: Full system access

## Testing

### Test Accounts

You can create test accounts by registering through the app, or use these credentials if seeded:

**System Admin:**
- Email: admin@example.com
- Password: password123

**Parent:**
- Email: parent@example.com
- Password: password123

## Troubleshooting

### Cannot connect to backend

1. Ensure the backend server is running on port 3000
2. Check the API_URL in `/src/api/client.ts` matches your setup
3. If using a physical device, ensure it's on the same network as your computer

### Metro bundler issues

```bash
# Clear cache and restart
npm start -- --clear
```

### Module resolution errors

```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

## Building for Production

### iOS

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Configure and build:
   ```bash
   eas build --platform ios
   ```

### Android

```bash
eas build --platform android
```

## Environment Variables

Create a `.env` file in the root directory:

```env
API_URL=http://your-api-url.com/api
```

## Technologies Used

- **React Native**: Cross-platform mobile framework
- **Expo**: Development platform
- **TypeScript**: Type safety
- **React Navigation**: Navigation library
- **React Query**: Data fetching and caching
- **AsyncStorage**: Local storage
- **Axios**: HTTP client

## Contributing

1. Create a feature branch
2. Make your changes
3. Test on both iOS and Android
4. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub or contact support.
