export function getApiBaseUrl() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const useEmulator = import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === "1";
  const projectId = import.meta.env.VITE_FUNCTIONS_PROJECT_ID || "agent-eregi";

  if (isLocal && useEmulator) {
    return `http://127.0.0.1:5001/${projectId}/asia-northeast3/api`;
  }

  // Firebase Hosting rewrite rules handle /v1/** in production
  // We MUST return empty string so that requests like fetch("/v1/user/submissions")
  // become relative to the current domain (e.g. https://agentregi-user-web.web.app/v1/user/submissions)
  if (!isLocal) {
    return "";
  }

  // Fallback for local dev without emulator
  const explicit = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE;
  if (explicit) return explicit.replace(/\/$/, "");
  
  return `https://asia-northeast3-${projectId}.cloudfunctions.net/api`;
}
