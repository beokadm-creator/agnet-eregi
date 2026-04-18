import { auth } from "@rp/firebase";
import { signInAnonymously } from "firebase/auth";

export const apiBase = import.meta.env.VITE_API_BASE || "";

export async function ensureLogin() {
  if (!auth.currentUser) await signInAnonymously(auth);
  return await auth.currentUser!.getIdToken(true);
}

export async function apiPost(path: string, body: any) {
  const token = await ensureLogin();
  const resp = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": crypto.randomUUID()
    },
    body: JSON.stringify(body)
  });
  const json = await resp.json();
  if (!json.ok && resp.status !== 412) throw new Error(json.error?.messageKo || "요청 실패");
  return { ok: json.ok, data: json.data, error: json.error, status: resp.status };
}

export async function apiGet(path: string) {
  const token = await ensureLogin();
  const resp = await fetch(`${apiBase}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` }
  });
  const json = await resp.json();
  if (!json.ok) throw new Error(json.error?.messageKo || "요청 실패");
  return json.data;
}

export async function becomePartner() {
  await apiPost("/v1/dev/set-claims", { claims: { role: "partner", partnerId: "p_demo_01" } });
  await ensureLogin();
}
