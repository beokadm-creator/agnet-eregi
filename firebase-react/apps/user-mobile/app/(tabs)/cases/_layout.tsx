import { Stack, router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable } from "react-native";

export default function CasesLayout() {
  return (
    <Stack
      screenOptions={{
        headerRight: () => (
          <Pressable onPress={() => router.push("/settings")} style={{ paddingHorizontal: 12 }}>
            <MaterialIcons name="settings" size={22} color="#0f172a" />
          </Pressable>
        )
      }}
    >
      <Stack.Screen name="index" options={{ title: "내 사건" }} />
      <Stack.Screen name="[id]" options={{ title: "사건 상세" }} />
      <Stack.Screen name="[id]/requests/[requestId]" options={{ title: "보완 요청" }} />
    </Stack>
  );
}
