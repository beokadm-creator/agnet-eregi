import { Stack } from "expo-router";

export default function CasesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "내 사건" }} />
      <Stack.Screen name="[id]" options={{ title: "사건 상세" }} />
      <Stack.Screen name="[id]/requests/[requestId]" options={{ title: "보완 요청" }} />
    </Stack>
  );
}
