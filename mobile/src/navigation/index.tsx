import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';

// Screens
import { LandingScreen } from '../screens/LandingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ParentDashboardScreen } from '../screens/ParentDashboardScreen';
import { AdminDashboardScreen } from '../screens/AdminDashboardScreen';
import { AddChildScreen } from '../screens/AddChildScreen';
import { NewApplicationScreen } from '../screens/NewApplicationScreen';
import { DaycareDashboardScreen } from '../screens/DaycareDashboardScreen';
import { FunderDashboardScreen } from '../screens/FunderDashboardScreen';

const Stack = createNativeStackNavigator();

export const Navigation = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or a loading screen
  }

  const getDashboardScreen = () => {
    if (!user) return null;

    switch (user.role) {
      case 'parent':
        return 'ParentDashboard';
      case 'system_admin':
        return 'AdminDashboard';
      case 'daycare_admin':
        return 'DaycareDashboard';
      case 'funder':
        return 'FunderDashboard';
      default:
        return 'ParentDashboard';
    }
  };

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
        initialRouteName={user ? getDashboardScreen()! : 'Landing'}
      >
        {!user ? (
          // Auth Stack
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          // App Stack
          <>
            {user.role === 'parent' && (
              <>
                <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} />
                <Stack.Screen name="AddChild" component={AddChildScreen} />
                <Stack.Screen name="NewApplication" component={NewApplicationScreen} />
              </>
            )}
            {user.role === 'system_admin' && (
              <>
                <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
                <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} />
                <Stack.Screen name="AddChild" component={AddChildScreen} />
                <Stack.Screen name="NewApplication" component={NewApplicationScreen} />
                <Stack.Screen name="DaycareDashboard" component={DaycareDashboardScreen} />
              </>
            )}
            {user.role === 'daycare_admin' && (
              <Stack.Screen name="DaycareDashboard" component={DaycareDashboardScreen} />
            )}
            {user.role === 'funder' && (
              <Stack.Screen name="FunderDashboard" component={FunderDashboardScreen} />
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
