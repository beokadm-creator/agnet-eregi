import { useState, useMemo } from "react";
import { getApiBaseUrl } from "./apiBase";
import { useAuth } from "./context/AuthContext";

export function useOpsApi() {
  const { token } = useAuth();
  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>("");

  async function callApi(path: string, init: RequestInit = {}) {
    setBusy(true);
    setError("");
    try {
      if (!token) throw new Error("인증이 필요합니다.");
      const res = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) throw new Error(json?.error?.messageKo || json?.error?.code || `HTTP ${res.status}`);
      setData(json?.data ?? json);
    } catch (error) {
      setData(null);
      setError(error instanceof Error ? error.message : "Unknown failure");
    } finally {
      setBusy(false);
    }
  }

  return { busy, data, error, callApi };
}
