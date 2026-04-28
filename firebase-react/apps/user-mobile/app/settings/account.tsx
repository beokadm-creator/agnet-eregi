import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import auth from "@react-native-firebase/auth";
import { useApi } from "../../hooks/useApi";

export default function AccountSettingsScreen() {
  const { busy, error, callApi } = useApi();
  const statusApi = useApi();
  const user = auth().currentUser;
  const [status, setStatus] = useState<string>("none");
  const [job, setJob] = useState<any>(null);

  useEffect(() => {
    statusApi.callApi("/v1/user/account/deletion-status")
      .then((res: any) => {
        const st = res?.status || "none";
        setStatus(String(st));
        setJob(res);
      })
      .catch(() => {})
      .finally(() => {});
  }, []);

  async function deleteAccount() {
    Alert.alert("계정 삭제", "계정과 관련된 푸시 토큰/설정이 삭제되고, 로그인도 해제됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await callApi("/v1/user/account", { method: "DELETE" });
          } catch {}
          try {
            await auth().signOut();
          } catch {}
          router.replace("/");
        }
      }
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>현재 로그인</Text>
        <Text style={styles.row}>UID: {user?.uid || "-"}</Text>
        <Text style={styles.row}>Email: {user?.email || "-"}</Text>
        <Text style={styles.row}>Anonymous: {user?.isAnonymous ? "YES" : "NO"}</Text>
        <Text style={styles.row}>Provider: {user?.providerData?.map((p) => p.providerId).filter(Boolean).join(", ") || "-"}</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>탈퇴 상태</Text>
        {statusApi.busy ? <ActivityIndicator /> : <Text style={styles.row}>status: {status}</Text>}
        {job?.progress ? <Text style={styles.meta}>{JSON.stringify(job.progress)}</Text> : null}
        {statusApi.error ? <Text style={styles.error}>{statusApi.error}</Text> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable disabled={busy || status === "queued" || status === "processing"} style={[styles.dangerButton, (busy || status === "queued" || status === "processing") && styles.disabled]} onPress={deleteAccount}>
        <Text style={styles.dangerText}>계정 삭제</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 10,
  },
  row: {
    fontSize: 13,
    color: "#334155",
    marginTop: 6,
  },
  meta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 8,
  },
  error: {
    color: "#b91c1c",
    marginTop: 12,
  },
  dangerButton: {
    marginTop: 16,
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
