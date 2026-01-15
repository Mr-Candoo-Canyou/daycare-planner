# Quick Start Guide - Daycare Planner Mobile App

## 🚀 Get Running in 5 Minutes

### Step 1: Install Expo Go on Your Phone

Download the **Expo Go** app:
- **iPhone**: [App Store](https://apps.apple.com/app/expo-go/id982107779)
- **Android**: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

### Step 2: Configure Backend Connection

1. Find your computer's IP address:

   **Mac/Linux:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

   **Windows:**
   ```bash
   ipconfig
   ```
   Look for "IPv4 Address" (usually starts with 192.168.x.x)

2. Update the API URL in `src/config/env.ts`:

   ```typescript
   export const config = {
     API_URL: 'http://YOUR_IP_HERE:3000/api', // Replace with your actual IP
   };
   ```

   Example: `http://192.168.1.100:3000/api`

### Step 3: Make Sure Backend is Running

In your main daycare-planner directory:

```bash
cd backend
npm run dev
```

Make sure it's running on port 3000.

### Step 4: Start the Mobile App

In the mobile directory:

```bash
npm install   # First time only
npm start
```

### Step 5: Open on Your Phone

1. Open **Expo Go** app on your phone
2. Scan the QR code from your terminal
3. Wait for the app to load (first time takes ~30 seconds)

### Step 6: Test the App

1. **Landing Page** should appear first
2. Click "Create Account" to register
3. Fill in:
   - First Name: Test
   - Last Name: User
   - Email: test@example.com
   - Role: Parent
   - Password: password123

4. You'll be logged in and see the Parent Dashboard!

## 🔧 Troubleshooting

### "Unable to connect to server"

1. Make sure your phone and computer are on the **same WiFi network**
2. Check that the backend is running (`npm run dev` in backend folder)
3. Verify the IP address in `src/config/env.ts` is correct
4. Try disabling any firewall on your computer temporarily

### "Cannot find module" errors

```bash
rm -rf node_modules
npm install
```

### App won't load on phone

1. Close Expo Go completely
2. Restart the development server: `npm start -- --clear`
3. Scan the QR code again

## 📱 Testing Different User Roles

### Create a System Admin Account

1. Register with role: "Parent" (default)
2. In your backend, update the user role directly in the database:

   ```sql
   UPDATE users SET role = 'system_admin' WHERE email = 'your@email.com';
   ```

3. Restart the app - you'll see the Admin Dashboard

### Create Multiple Test Accounts

You can register different accounts with different roles to test all features:

- **parent@test.com** - Parent role
- **admin@test.com** - Daycare Admin role
- **sysadmin@test.com** - System Admin role (needs DB update)

## 🎯 What to Test

### Parent Features
- ✅ Add children
- ✅ Create applications with multiple daycare choices
- ✅ View application status
- ✅ Opt-in to parent network

### Admin Features
- ✅ View system statistics
- ✅ Manage users
- ✅ Manage daycares
- ✅ View all applications

## 🔥 Pro Tips

1. **Shake your phone** while in the app to open the developer menu
2. Enable **Fast Refresh** to see code changes instantly
3. Check the **Metro bundler terminal** for errors
4. Use **React DevTools** for debugging (opens in Chrome)

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Customize the UI colors in component stylesheets
- Add more features to the dashboards
- Build additional screens for daycare admins and funders

## 📞 Need Help?

- Check the [README.md](README.md) for full documentation
- Review error messages in the terminal
- Ensure backend and mobile are both running
- Verify your network connection

Happy coding! 🎉
