import { useCallback, useMemo, useState } from "react";
import auth from "@react-native-firebase/auth";
import { getApiBaseUrl } from "../lib/apiBase";

export function useApi() {
  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const callApi = useCallback(async (path: string, init: RequestInit = {}) => {
    setBusy(true);
    setError("");
    try {
      const token = await auth().currentUser?.getIdToken();
      if (!token) throw new Error("인증이 필요합니다.");

      const extraHeaders =
        init.headers instanceof Headers
          ? Object.fromEntries(init.headers.entries())
          : Array.isArray(init.headers)
            ? Object.fromEntries(init.headers)
            : (init.headers ?? {});

      const res = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(extraHeaders as Record<string, string>),
        },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) throw new Error(json?.error?.messageKo || json?.error?.code || `HTTP ${res.status}`);
      setData(json?.data ?? json);
      return json?.data ?? json;
    } catch (e) {
      setData(null);
      const msg = e instanceof Error ? e.message : "Unknown failure";
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [apiBase]);

  return { busy, data, error, callApi };
}
