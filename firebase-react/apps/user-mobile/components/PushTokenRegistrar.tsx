import { useEffect, useState } from "react";
import { Platform } from "react-native";
import auth from "@react-native-firebase/auth";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useApi } from "../hooks/useApi";

export default function PushTokenRegistrar() {
  const { expoPushToken } = usePushNotifications();
  const { callApi } = useApi();
  const [uid, setUid] = useState<string>("");
  const [lastSent, setLastSent] = useState<string>("");

  useEffect(() => {
    const unsub = auth().onAuthStateChanged((u: any) => setUid(u?.uid || ""));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    if (!expoPushToken) return;
    if (expoPushToken === lastSent) return;
    if (!expoPushToken.includes("PushToken[")) return;

    callApi("/v1/user/push-tokens", { method: "PUT", body: JSON.stringify({ token: expoPushToken, platform: Platform.OS }) })
      .then(() => setLastSent(expoPushToken))
      .catch(() => {});
  }, [uid, expoPushToken, lastSent]);

  return null;
}
