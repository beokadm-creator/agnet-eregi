import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import auth from "@react-native-firebase/auth";
import { useApi } from "../../hooks/useApi";

export default function ProfileScreen() {
  const { busy, error, callApi } = useApi();
  const [loaded, setLoaded] = useState(false);
  const [expoEnabled, setExpoEnabled] = useState(false);
  const [submissionCompleted, setSubmissionCompleted] = useState(false);
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const [evidenceRequested, setEvidenceRequested] = useState(true);
  const [webhooks, setWebhooks] = useState<any[]>([]);

  useEffect(() => {
    callApi("/v1/user/notification-settings")
      .then((res: any) => {
        const s = res?.settings || {};
        setWebhooks(Array.isArray(s.webhooks) ? s.webhooks : []);
        setExpoEnabled(!!s.channels?.expo?.enabled);
        setSubmissionCompleted(!!s.events?.submissionCompleted);
        setSubmissionFailed(!!s.events?.submissionFailed);
        setEvidenceRequested(s.events?.evidenceRequested !== false);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function saveSettings() {
    await callApi("/v1/user/notification-settings", {
      method: "PUT",
      body: JSON.stringify({
        webhooks,
        channels: { expo: { enabled: expoEnabled } },
        events: { submissionCompleted, submissionFailed, evidenceRequested },
      }),
    });
  }

  const handleLogout = async () => {
    await auth().signOut();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>내 프로필</Text>
      <Text style={styles.description}>{auth().currentUser?.email || auth().currentUser?.uid}</Text>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>푸시 알림</Text>
        {!loaded ? <ActivityIndicator /> : null}
        {loaded && error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable disabled={busy} style={[styles.row, busy && styles.rowDisabled]} onPress={() => setExpoEnabled((v) => !v)}>
          <Text style={styles.rowLabel}>푸시 알림 사용</Text>
          <Text style={styles.rowValue}>{expoEnabled ? "ON" : "OFF"}</Text>
        </Pressable>

        <View style={[styles.subPanel, !expoEnabled && styles.subPanelDisabled]}>
          <Pressable disabled={busy || !expoEnabled} style={[styles.row, (busy || !expoEnabled) && styles.rowDisabled]} onPress={() => setEvidenceRequested((v) => !v)}>
            <Text style={styles.rowLabel}>보완 요청(evidence.requested)</Text>
            <Text style={styles.rowValue}>{evidenceRequested ? "ON" : "OFF"}</Text>
          </Pressable>
          <Pressable disabled={busy || !expoEnabled} style={[styles.row, (busy || !expoEnabled) && styles.rowDisabled]} onPress={() => setSubmissionCompleted((v) => !v)}>
            <Text style={styles.rowLabel}>제출 완료(submission.completed)</Text>
            <Text style={styles.rowValue}>{submissionCompleted ? "ON" : "OFF"}</Text>
          </Pressable>
          <Pressable disabled={busy || !expoEnabled} style={[styles.row, (busy || !expoEnabled) && styles.rowDisabled]} onPress={() => setSubmissionFailed((v) => !v)}>
            <Text style={styles.rowLabel}>제출 실패(submission.failed)</Text>
            <Text style={styles.rowValue}>{submissionFailed ? "ON" : "OFF"}</Text>
          </Pressable>
        </View>

        <Pressable disabled={busy} style={[styles.saveButton, busy && styles.rowDisabled]} onPress={saveSettings}>
          <Text style={styles.saveText}>{busy ? "저장 중..." : "저장"}</Text>
        </Pressable>
      </View>
      
      <View style={styles.buttonContainer}>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#475569',
  },
  panel: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  subPanel: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
  },
  subPanelDisabled: {
    opacity: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowLabel: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "700",
  },
  rowValue: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "800",
  },
  saveButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: "#3730a3",
    fontWeight: "800",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 8,
  },
  buttonContainer: {
    marginTop: 40,
    borderRadius: 8,
    overflow: 'hidden',
  },
  logoutButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "800",
  },
});
