import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { usePushNotifications } from "../../hooks/usePushNotifications";

function formatTs(ts: any): string {
  if (!ts) return "-";
  if (typeof ts === "string") return ts;
  if (typeof ts.toDate === "function") return ts.toDate().toLocaleString();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000).toLocaleString();
  return "-";
}

function shortToken(token: string): string {
  if (!token) return "-";
  if (token.length <= 18) return token;
  return `${token.slice(0, 10)}…${token.slice(-6)}`;
}

export default function DevicesScreen() {
  const listApi = useApi();
  const actionApi = useApi();
  const { expoPushToken } = usePushNotifications();
  const items: any[] = listApi.data?.items || [];

  useEffect(() => {
    listApi.callApi("/v1/user/push-tokens");
  }, []);

  async function deleteById(id: string) {
    Alert.alert("삭제", "이 기기 토큰을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await actionApi.callApi(`/v1/user/push-tokens/${id}`, { method: "DELETE" });
            await listApi.callApi("/v1/user/push-tokens");
          } catch {}
        },
      },
    ]);
  }

  async function deleteCurrent() {
    if (!expoPushToken || !expoPushToken.includes("PushToken[")) return;
    Alert.alert("삭제", "현재 기기 토큰을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await actionApi.callApi("/v1/user/push-tokens", { method: "DELETE", body: JSON.stringify({ token: expoPushToken }) });
            await listApi.callApi("/v1/user/push-tokens");
          } catch {}
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>현재 기기</Text>
        <Text style={styles.meta}>token: {expoPushToken ? shortToken(expoPushToken) : "-"}</Text>
        <Pressable disabled={actionApi.busy || !expoPushToken} style={[styles.dangerButton, (actionApi.busy || !expoPushToken) && styles.disabled]} onPress={deleteCurrent}>
          <Text style={styles.dangerText}>현재 기기 토큰 삭제</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>등록된 토큰</Text>
        {listApi.busy && items.length === 0 ? <ActivityIndicator /> : null}
        {!listApi.busy && listApi.error ? <Text style={styles.error}>{listApi.error}</Text> : null}

        <View style={{ gap: 10, marginTop: 10 }}>
          {items.map((it) => (
            <View key={String(it.id)} style={styles.card}>
              <Text style={styles.cardTitle}>{it.platform || it.provider || "device"}</Text>
              <Text style={styles.meta}>token: {shortToken(String(it.token || ""))}</Text>
              <Text style={styles.meta}>updatedAt: {formatTs(it.updatedAt)}</Text>
              <Pressable disabled={actionApi.busy} style={[styles.button, actionApi.busy && styles.disabled]} onPress={() => deleteById(String(it.id))}>
                <Text style={styles.buttonText}>삭제</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f8fafc",
  },
  panel: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  meta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 6,
  },
  error: {
    color: "#b91c1c",
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  button: {
    marginTop: 10,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#b91c1c",
    fontWeight: "800",
  },
  dangerButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: {
    color: "#b91c1c",
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.5,
  },
});

