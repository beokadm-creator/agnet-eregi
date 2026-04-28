import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { T, R, S, FS, FW, BH } from '../../lib/tokens';

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
    padding: S.lg,
    backgroundColor: T.paper,
  },
  panel: {
    borderWidth: 1,
    borderColor: T.hairline,
    backgroundColor: T.canvas,
    borderRadius: R.r2,
    padding: S.base,
    marginBottom: S.md,
  },
  title: {
    fontSize: FS.md,
    fontWeight: FW.extrabold,
    color: T.ink,
  },
  meta: {
    fontSize: FS.sm,
    color: T.slate,
    marginTop: S.sm - 2,
  },
  error: {
    color: T.danger,
    marginTop: S.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: T.hairline,
    backgroundColor: T.paper,
    borderRadius: R.r2,
    padding: S.md,
  },
  cardTitle: {
    fontSize: FS.body,
    fontWeight: FW.extrabold,
    color: T.ink,
  },
  button: {
    marginTop: S.sm + 2,
    height: BH.sm + 6,
    borderRadius: R.r2,
    borderWidth: 1,
    borderColor: T.dangerSoft,
    backgroundColor: T.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: T.danger,
    fontWeight: FW.extrabold,
  },
  dangerButton: {
    marginTop: S.md,
    height: BH.default,
    borderRadius: R.r2,
    borderWidth: 1,
    borderColor: T.dangerSoft,
    backgroundColor: T.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: {
    color: T.danger,
    fontWeight: FW.extrabold,
  },
  disabled: {
    opacity: 0.5,
  },
});

