import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import auth from "@react-native-firebase/auth";
import { useApi } from "../../hooks/useApi";
import { T, R, S, FS, FW, BH } from '../../lib/tokens';

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

  async function cancelAllActiveSubmissions() {
    for (const s of activeSubmissions) {
      await callApi(`/v1/user/submissions/${String(s.id)}/cancel`, { method: "POST" });
    }
    await refreshAll();
  }

  async function cancelAllAndDeleteAccount() {
    await cancelAllActiveSubmissions();
    await callApi("/v1/user/account", { method: "DELETE" });
    await auth().signOut();
    router.replace("/");
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
          <View style={{ gap: 10, marginTop: 12 }}>
            <Pressable
              disabled={busy}
              style={[styles.dangerButton, busy && styles.disabled, { marginTop: 0 }]}
              onPress={() => {
                Alert.alert("일괄 취소", "진행 중 제출을 모두 취소할까요?", [
                  { text: "취소", style: "cancel" },
                  {
                    text: "진행",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await cancelAllActiveSubmissions();
                      } catch {}
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.dangerText}>진행 중 제출 모두 취소</Text>
            </Pressable>

            <Pressable
              disabled={busy}
              style={[styles.dangerButton, busy && styles.disabled, { marginTop: 0 }]}
              onPress={() => {
                Alert.alert("취소 후 탈퇴", "진행 중 제출을 모두 취소한 뒤 바로 탈퇴를 진행할까요?", [
                  { text: "취소", style: "cancel" },
                  {
                    text: "진행",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await cancelAllAndDeleteAccount();
                      } catch (e: any) {
                        await refreshAll();
                        Alert.alert("탈퇴 불가", e?.message || "탈퇴를 완료할 수 없습니다.");
                      }
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.dangerText}>모두 취소 후 탈퇴</Text>
            </Pressable>
          </View>
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
    marginBottom: S.sm + 2,
  },
  row: {
    fontSize: FS.label,
    color: T.graphite,
    marginTop: S.sm - 2,
  },
  meta: {
    fontSize: FS.sm,
    color: T.slate,
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
    fontSize: FS.label,
    fontWeight: FW.extrabold,
    color: T.ink,
  },
  cardActions: {
    marginTop: S.sm + 2,
    flexDirection: "row",
    gap: S.sm + 2,
  },
  cardButton: {
    flex: 1,
    height: BH.sm + 6,
    borderRadius: R.r2,
    borderWidth: 1,
    borderColor: T.accent,
    backgroundColor: T.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardButtonText: {
    color: T.accentInk,
    fontWeight: FW.extrabold,
  },
  cardDangerButton: {
    flex: 1,
    height: BH.sm + 6,
    borderRadius: R.r2,
    borderWidth: 1,
    borderColor: T.dangerSoft,
    backgroundColor: T.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardDangerText: {
    color: T.danger,
    fontWeight: FW.extrabold,
  },
  error: {
    color: T.danger,
    marginTop: S.md,
  },
  dangerButton: {
    marginTop: S.base,
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
