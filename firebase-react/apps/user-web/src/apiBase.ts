export function getApiBaseUrl() {
  const explicit = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE;
  if (explicit) return explicit.replace(/\/$/, "");

  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const useEmulator = import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === "1";
  const projectId = import.meta.env.VITE_FUNCTIONS_PROJECT_ID || "agent-eregi";

  if (isLocal && useEmulator) {
    return `http://127.0.0.1:5001/${projectId}/asia-northeast3/api`;
  }

  // Firebase Hosting rewrite rules handle /v1/** in production
  // so we can use relative paths and avoid CORS entirely
  if (!isLocal) {
    return "";
  }

  return `https://asia-northeast3-${projectId}.cloudfunctions.net/api`;
}
