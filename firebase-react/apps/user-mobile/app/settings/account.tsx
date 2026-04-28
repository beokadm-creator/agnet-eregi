import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import auth from "@react-native-firebase/auth";
import { useApi } from "../../hooks/useApi";

export default function AccountSettingsScreen() {
  const { busy, error, callApi } = useApi();
  const statusApi = useApi();
  const submissionsApi = useApi();
  const user = auth().currentUser;
  const [status, setStatus] = useState<string>("none");
  const [job, setJob] = useState<any>(null);
  const submissions: any[] = submissionsApi.data?.items || [];
  const activeSubmissions = submissions.filter((s) => ["submitted", "processing"].includes(String(s.status)));
  const deleteDisabled = busy || status === "queued" || status === "processing" || activeSubmissions.length > 0;

  useEffect(() => {
    refreshAll();
  }, []);

  async function refreshAll() {
    await Promise.all([
      statusApi.callApi("/v1/user/account/deletion-status")
        .then((res: any) => {
          const st = res?.status || "none";
          setStatus(String(st));
          setJob(res);
        })
        .catch(() => {}),
      submissionsApi.callApi("/v1/user/submissions").catch(() => {}),
    ]);
  }

  async function cancelSubmission(submissionId: string) {
    await callApi(`/v1/user/submissions/${submissionId}/cancel`, { method: "POST" });
    await refreshAll();
  }

  async function deleteAccount() {
    Alert.alert("계정 삭제", "계정과 관련된 푸시 토큰/설정이 삭제되고, 로그인도 해제됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await callApi("/v1/user/account", { method: "DELETE" });
            await auth().signOut();
            router.replace("/");
          } catch (e: any) {
            await refreshAll();
            Alert.alert("탈퇴 불가", e?.message || "진행 중 제출이 있어 탈퇴할 수 없습니다.");
          }
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

      <View style={styles.panel}>
        <Text style={styles.title}>진행 중 제출</Text>
        {submissionsApi.busy && submissions.length === 0 ? <ActivityIndicator /> : null}
        {!submissionsApi.busy && submissionsApi.error ? <Text style={styles.error}>{submissionsApi.error}</Text> : null}

        {activeSubmissions.length === 0 ? (
          <Text style={styles.row}>없음</Text>
        ) : (
          <View style={{ gap: 10, marginTop: 10 }}>
            {activeSubmissions.map((s) => (
              <View key={String(s.id)} style={styles.card}>
                <Text style={styles.cardTitle}>ID: {String(s.id)}</Text>
                <Text style={styles.meta}>status: {String(s.status)}</Text>
                <View style={styles.cardActions}>
                  <Pressable style={styles.cardButton} onPress={() => router.push(`/(tabs)/cases/${String(s.id)}`)}>
                    <Text style={styles.cardButtonText}>열기</Text>
                  </Pressable>
                  <Pressable disabled={busy} style={[styles.cardDangerButton, busy && styles.disabled]} onPress={() => cancelSubmission(String(s.id))}>
                    <Text style={styles.cardDangerText}>취소</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeSubmissions.length > 0 ? (
          <Pressable
            disabled={busy}
            style={[styles.dangerButton, busy && styles.disabled, { marginTop: 12 }]}
            onPress={() => {
              Alert.alert("일괄 취소", "진행 중 제출을 모두 취소한 뒤 탈퇴를 다시 시도할까요?", [
                { text: "취소", style: "cancel" },
                {
                  text: "진행",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      for (const s of activeSubmissions) {
                        await cancelSubmission(String(s.id));
                      }
                      await refreshAll();
                    } catch {}
                  },
                },
              ]);
            }}
          >
            <Text style={styles.dangerText}>진행 중 제출 모두 취소</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable disabled={deleteDisabled} style={[styles.dangerButton, deleteDisabled && styles.disabled]} onPress={deleteAccount}>
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
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  cardActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
  },
  cardButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  cardButtonText: {
    color: "#3730a3",
    fontWeight: "800",
  },
  cardDangerButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    alignItems: "center",
    justifyContent: "center",
  },
  cardDangerText: {
    color: "#b91c1c",
    fontWeight: "800",
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
