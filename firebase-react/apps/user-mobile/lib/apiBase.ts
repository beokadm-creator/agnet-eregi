import Constants from "expo-constants";

export function getApiBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const projectId = process.env.EXPO_PUBLIC_FUNCTIONS_PROJECT_ID || "agent-eregi";

  const hostUri = Constants.expoConfig?.hostUri || "";
  const isLocal = hostUri.includes("localhost") || hostUri.includes("127.0.0.1");
  const useEmulator = process.env.EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR === "1";

  if (isLocal && useEmulator) {
    const emulatorHost = process.env.EXPO_PUBLIC_EMULATOR_HOST || "127.0.0.1";
    return `http://${emulatorHost}:5001/${projectId}/asia-northeast3/api`;
  }

  return `https://asia-northeast3-${projectId}.cloudfunctions.net/api`;
}

