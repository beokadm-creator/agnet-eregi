import { useState, useMemo } from "react";
import { getApiBaseUrl } from "./apiBase";
import { useAuth } from "./context/AuthContext";

export function useOpsApi() {
  const { token } = useAuth();
  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  async function callApi(path: string, init: RequestInit = {}) {
    setBusy(true);
    try {
      if (!token) throw new Error("인증이 필요합니다.");
      const res = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) throw new Error(json?.error?.messageKo || json?.error?.code || `HTTP ${res.status}`);
      setLog(JSON.stringify(json?.data || json, null, 2));
    } catch (error) {
      setLog(error instanceof Error ? `[Error] ${error.message}` : "[Error] Unknown failure");
    } finally {
      setBusy(false);
    }
  }

  return { busy, log, setLog, callApi };
}
