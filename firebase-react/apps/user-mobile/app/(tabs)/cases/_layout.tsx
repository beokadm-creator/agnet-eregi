import { Stack, router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { T, S } from '../../../lib/tokens';

export default function CasesLayout() {
  return (
    <Stack
      screenOptions={{
        headerRight: () => (
          <Pressable onPress={() => router.push("/settings")} style={{ paddingHorizontal: S.md }}>
            <MaterialIcons name="settings" size={22} color={T.ink} />
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
