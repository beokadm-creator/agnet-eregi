import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

function routeFromData(data: any): string {
  const explicit = data?.route;
  if (typeof explicit === "string" && explicit.startsWith("/")) return explicit;

  const submissionId = data?.submissionId ? String(data.submissionId) : "";
  const requestId = data?.requestId ? String(data.requestId) : "";
  if (submissionId && requestId) return `/(tabs)/cases/${submissionId}/requests/${requestId}`;
  if (submissionId) return `/(tabs)/cases/${submissionId}`;
  return "";
}

export default function NotificationNavigator() {
  useEffect(() => {
    let mounted = true;

    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (!mounted) return;
      const data = resp?.notification?.request?.content?.data;
      const route = routeFromData(data);
      if (route) router.push(route);
    }).catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp?.notification?.request?.content?.data;
      const route = routeFromData(data);
      if (route) router.push(route);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return null;
}

