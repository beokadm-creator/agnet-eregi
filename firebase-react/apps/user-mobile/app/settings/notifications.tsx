import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { T, R, S, FS, FW, BH } from '../../lib/tokens';

export default function NotificationSettingsScreen() {
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

  return (
    <View style={styles.container}>
      {!loaded ? <ActivityIndicator /> : null}
      {loaded && error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>푸시 알림</Text>

        <Pressable disabled={busy} style={[styles.row, busy && styles.rowDisabled]} onPress={() => setExpoEnabled((v) => !v)}>
          <Text style={styles.rowLabel}>푸시 알림 사용</Text>
          <Text style={styles.rowValue}>{expoEnabled ? "ON" : "OFF"}</Text>
        </Pressable>

        <View style={[styles.subPanel, !expoEnabled && styles.subPanelDisabled]}>
          <Pressable disabled={busy || !expoEnabled} style={[styles.row, (busy || !expoEnabled) && styles.rowDisabled]} onPress={() => setEvidenceRequested((v) => !v)}>
            <Text style={styles.rowLabel}>보완 요청</Text>
            <Text style={styles.rowValue}>{evidenceRequested ? "ON" : "OFF"}</Text>
          </Pressable>
          <Pressable disabled={busy || !expoEnabled} style={[styles.row, (busy || !expoEnabled) && styles.rowDisabled]} onPress={() => setSubmissionCompleted((v) => !v)}>
            <Text style={styles.rowLabel}>제출 완료</Text>
            <Text style={styles.rowValue}>{submissionCompleted ? "ON" : "OFF"}</Text>
          </Pressable>
          <Pressable disabled={busy || !expoEnabled} style={[styles.row, (busy || !expoEnabled) && styles.rowDisabled]} onPress={() => setSubmissionFailed((v) => !v)}>
            <Text style={styles.rowLabel}>제출 실패</Text>
            <Text style={styles.rowValue}>{submissionFailed ? "ON" : "OFF"}</Text>
          </Pressable>
        </View>

        <Pressable disabled={busy} style={[styles.saveButton, busy && styles.rowDisabled]} onPress={saveSettings}>
          <Text style={styles.saveText}>{busy ? "저장 중..." : "저장"}</Text>
        </Pressable>
      </View>
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
    padding: S.md,
  },
  panelTitle: {
    fontSize: FS.md,
    fontWeight: FW.extrabold,
    color: T.ink,
    marginBottom: S.sm,
  },
  subPanel: {
    marginTop: S.sm + 2,
    borderTopWidth: 1,
    borderTopColor: T.hairline,
    paddingTop: S.sm + 2,
  },
  subPanelDisabled: {
    opacity: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: S.sm + 2,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowLabel: {
    fontSize: FS.body,
    color: T.ink,
    fontWeight: FW.bold,
  },
  rowValue: {
    fontSize: FS.body,
    color: T.graphite,
    fontWeight: FW.extrabold,
  },
  saveButton: {
    marginTop: S.md,
    height: BH.default,
    borderRadius: R.r2,
    borderWidth: 1,
    borderColor: T.accent,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: T.canvas,
    fontWeight: FW.extrabold,
  },
  error: {
    color: T.danger,
    marginBottom: S.md,
  },
});

