import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import PushTokenRegistrar from '../components/PushTokenRegistrar';
import NotificationNavigator from '../components/NotificationNavigator';

export default function RootLayout() {
  return (
    <>
      <NotificationNavigator />
      <PushTokenRegistrar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
