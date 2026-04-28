export function getApiBaseUrl() {
  const explicit = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE;
  if (explicit) return explicit.replace(/\/$/, "");

  const projectId = import.meta.env.VITE_FUNCTIONS_PROJECT_ID || "agent-eregi";
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const useEmulator = import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === "1";

  if (isLocal && useEmulator) {
    return `http://127.0.0.1:5001/${projectId}/asia-northeast3/api`;
  }

  return `https://asia-northeast3-${projectId}.cloudfunctions.net/api`;
}
