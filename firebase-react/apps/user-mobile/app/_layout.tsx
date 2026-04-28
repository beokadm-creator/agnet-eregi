import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import PushTokenRegistrar from '../components/PushTokenRegistrar';

export default function RootLayout() {
  return (
    <>
      <PushTokenRegistrar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
