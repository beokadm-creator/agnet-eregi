import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: "설정" }} />
      <Stack.Screen name="notifications" options={{ title: "알림 설정" }} />
    </Stack>
  );
}
