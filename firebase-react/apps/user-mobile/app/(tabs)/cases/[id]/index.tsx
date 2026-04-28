import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useApi } from "../../../../hooks/useApi";
import { T, R, S, FS, FW, BH } from '../../../../lib/tokens';
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

function formatTs(ts: any): string {
  if (!ts) return "-";
  if (typeof ts === "string") return ts;
  if (typeof ts.toDate === "function") return ts.toDate().toLocaleString();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000).toLocaleString();
  return "-";
}

export default function CaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const submissionApi = useApi();
  const actionApi = useApi();
  const eventsApi = useApi();
  const requestsApi = useApi();
  const [uploadPhase, setUploadPhase] = useState<string>("");

  const submission = submissionApi.data?.submission || submissionApi.data?.item || submissionApi.data || null;
  const events: any[] = eventsApi.data?.items || [];
  const requests: any[] = requestsApi.data?.items || [];

  useEffect(() => {
    if (!id) return;
    submissionApi.callApi(`/v1/user/submissions/${id}`);
    eventsApi.callApi(`/v1/user/submissions/${id}/events`);
    requestsApi.callApi(`/v1/user/submissions/${id}/evidence-requests`);
  }, [id]);

  const statusLabel = useMemo(() => ({
    draft: "작성중",
    collecting: "처리중",
    packaging: "처리중",
    ready: "완료",
    completed: "완료",
    failed: "실패",
  } as Record<string, string>), []);

  function guessContentType(uri: string): string {
    const lower = (uri || "").toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".pdf")) return "application/pdf";
    return "image/jpeg";
  }

  async function uploadEvidenceForRequest(requestId: string, itemCode: string, source: "library" | "camera") {
    if (!id) return;
    if (actionApi.busy) return;
    try {
      setUploadPhase("파일 선택");
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error("카메라 권한이 필요합니다.");
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error("사진 접근 권한이 필요합니다.");
      }

      const picker = source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (picker.canceled) return;

      const asset = picker.assets?.[0];
      if (!asset?.uri) return;

      const filename = asset.fileName || asset.uri.split("/").pop() || `upload_${Date.now()}.jpg`;
      setUploadPhase("파일 읽는 중");
      const fileRes = await fetch(asset.uri);
      const blob = await fileRes.blob();
      const contentType = blob.type || guessContentType(asset.uri);
      const sizeBytes = blob.size || (typeof asset.fileSize === "number" ? asset.fileSize : 0);
      if (sizeBytes > 25 * 1024 * 1024) throw new Error("파일 크기는 25MB 이하여야 합니다.");
      if (!["application/pdf", "image/png", "image/jpeg", "image/jpg"].includes(contentType)) throw new Error("허용되지 않는 파일 형식입니다.");

      setUploadPhase("업로드 URL 발급");
      const initRes = await actionApi.callApi(`/v1/user/submissions/${id}/evidences/upload-url`, {
        method: "POST",
        body: JSON.stringify({
          filename,
          contentType,
          sizeBytes: sizeBytes || 1,
          type: itemCode,
          requestId,
          itemCode
        })
      });

      const uploadUrl = initRes.uploadUrl as string;
      const evidenceId = initRes.evidenceId as string;
      if (!uploadUrl || !evidenceId) throw new Error("업로드 URL 발급 실패");

      setUploadPhase("업로드 중");
      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
      if (!putRes.ok) throw new Error(`스토리지 업로드 실패 (HTTP ${putRes.status})`);

      setUploadPhase("완료 처리");
      await actionApi.callApi(`/v1/user/submissions/${id}/evidences/${evidenceId}/complete`, { method: "POST" });

      setUploadPhase("새로고침");
      await requestsApi.callApi(`/v1/user/submissions/${id}/evidence-requests`);
      await submissionApi.callApi(`/v1/user/submissions/${id}`);
      await eventsApi.callApi(`/v1/user/submissions/${id}/events`);
    } catch (e: any) {
      Alert.alert("업로드 실패", e?.message || "Unknown failure");
    } finally {
      setUploadPhase("");
    }
  }

  async function uploadPdfForRequest(requestId: string, itemCode: string) {
    if (!id) return;
    if (actionApi.busy) return;
    try {
      setUploadPhase("파일 선택");
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf"], multiple: false, copyToCacheDirectory: true });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;

      const filename = asset.name || asset.uri.split("/").pop() || `upload_${Date.now()}.pdf`;
      setUploadPhase("파일 읽는 중");
      const fileRes = await fetch(asset.uri);
      const blob = await fileRes.blob();
      const contentType = blob.type || asset.mimeType || "application/pdf";
      const sizeBytes = blob.size || asset.size || 0;
      if (sizeBytes > 25 * 1024 * 1024) throw new Error("파일 크기는 25MB 이하여야 합니다.");
      if (!["application/pdf", "image/png", "image/jpeg", "image/jpg"].includes(contentType)) throw new Error("허용되지 않는 파일 형식입니다.");

      setUploadPhase("업로드 URL 발급");
      const initRes = await actionApi.callApi(`/v1/user/submissions/${id}/evidences/upload-url`, {
        method: "POST",
        body: JSON.stringify({
          filename,
          contentType,
          sizeBytes: sizeBytes || 1,
          type: itemCode,
          requestId,
          itemCode
        })
      });

      const uploadUrl = initRes.uploadUrl as string;
      const evidenceId = initRes.evidenceId as string;
      if (!uploadUrl || !evidenceId) throw new Error("업로드 URL 발급 실패");

      setUploadPhase("업로드 중");
      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
      if (!putRes.ok) throw new Error(`스토리지 업로드 실패 (HTTP ${putRes.status})`);

      setUploadPhase("완료 처리");
      await actionApi.callApi(`/v1/user/submissions/${id}/evidences/${evidenceId}/complete`, { method: "POST" });

      setUploadPhase("새로고침");
      await requestsApi.callApi(`/v1/user/submissions/${id}/evidence-requests`);
      await submissionApi.callApi(`/v1/user/submissions/${id}`);
      await eventsApi.callApi(`/v1/user/submissions/${id}/events`);
    } catch (e: any) {
      Alert.alert("업로드 실패", e?.message || "Unknown failure");
    } finally {
      setUploadPhase("");
    }
  }

  async function cancelSubmission() {
    if (!id) return;
    Alert.alert("취소", "정말 취소하시겠습니까?", [
      { text: "닫기", style: "cancel" },
      {
        text: "취소하기",
        style: "destructive",
        onPress: async () => {
          try {
            await actionApi.callApi(`/v1/user/submissions/${id}/cancel`, { method: "POST" });
            await submissionApi.callApi(`/v1/user/submissions/${id}`);
            await eventsApi.callApi(`/v1/user/submissions/${id}/events`);
          } catch {}
        }
      }
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {(actionApi.busy || uploadPhase) && (
        <View style={styles.banner}>
          <ActivityIndicator />
          <Text style={styles.bannerText}>업로드 처리 중{uploadPhase ? `: ${uploadPhase}` : ""}</Text>
        </View>
      )}
      {!actionApi.busy && actionApi.error ? <Text style={{ color: T.danger, marginBottom: S.md }}>{actionApi.error}</Text> : null}
      {submissionApi.busy && !submission && <ActivityIndicator />}
      {!submissionApi.busy && submissionApi.error ? <Text style={{ color: T.danger }}>{submissionApi.error}</Text> : null}

      {submission && (
        <View style={styles.panel}>
          <Text style={styles.title}>{submission.title || submission.id}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>상태: {statusLabel[String(submission.status || "unknown")] || String(submission.status || "unknown")}</Text>
          </View>
          <Text style={styles.meta}>ID: {submission.id}</Text>
          <Text style={styles.meta}>생성: {formatTs(submission.createdAt)}</Text>
          <Text style={styles.meta}>수정: {formatTs(submission.updatedAt)}</Text>

          <View style={{ marginTop: 12 }}>
            <Pressable disabled={actionApi.busy} onPress={cancelSubmission} style={[styles.cancelButton, actionApi.busy && styles.actionButtonDisabled]}>
              <Text style={styles.cancelText}>제출 취소</Text>
            </Pressable>
          </View>

          {submission.summary && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionTitle}>요약</Text>
              <Text style={styles.body}>{String(submission.summary)}</Text>
            </View>
          )}

          {submission.intent && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionTitle}>Intent</Text>
              <Text style={styles.body}>{String(submission.intent)}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>진행 로그</Text>
        {eventsApi.busy && events.length === 0 && <ActivityIndicator />}
        {!eventsApi.busy && eventsApi.error ? <Text style={{ color: T.danger }}>{eventsApi.error}</Text> : null}
        {events.length === 0 && !eventsApi.busy && !eventsApi.error ? (
          <Text style={styles.body}>이벤트가 없습니다.</Text>
        ) : (
          <View style={{ marginTop: 8, gap: 8 }}>
            {events.map((ev) => (
              <View key={String(ev.id)} style={styles.rowCard}>
                <Text style={styles.rowTitle}>{ev.type || "event"}</Text>
                <Text style={styles.rowMeta}>{formatTs(ev.createdAt)}</Text>
                {ev.message ? <Text style={styles.body}>{String(ev.message)}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>추가 서류 요청</Text>
        {requestsApi.busy && requests.length === 0 && <ActivityIndicator />}
        {!requestsApi.busy && requestsApi.error ? <Text style={{ color: T.danger }}>{requestsApi.error}</Text> : null}
        {requests.length === 0 && !requestsApi.busy && !requestsApi.error ? (
          <Text style={styles.body}>요청이 없습니다.</Text>
        ) : (
          <View style={{ marginTop: 8, gap: 8 }}>
            {requests.map((r) => (
              <Pressable disabled={actionApi.busy} key={String(r.id)} style={[styles.rowCard, actionApi.busy && styles.actionButtonDisabled]} onPress={() => router.push(`/(tabs)/cases/${id}/requests/${String(r.id)}`)}>
                <Text style={styles.rowTitle}>요청 ID: {String(r.id)}</Text>
                <Text style={styles.rowMeta}>{formatTs(r.createdAt)}</Text>
                {r.messageToUserKo ? <Text style={styles.body}>{String(r.messageToUserKo)}</Text> : null}
                {r.status ? <Text style={styles.rowMeta}>status: {String(r.status)}</Text> : null}

                {Array.isArray(r.items) && r.items.length > 0 ? (
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {r.items.map((it: any) => {
                      const open = String(it.status) === "open";
                      return (
                        <View key={String(it.code)} style={styles.itemCard}>
                          <Text style={styles.itemTitle}>{it.titleKo || it.code}</Text>
                          <Text style={styles.itemMeta}>code: {String(it.code)} · status: {String(it.status)}</Text>
                          {open ? (
                            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                              <Pressable disabled={actionApi.busy} style={[styles.actionButton, actionApi.busy && styles.actionButtonDisabled]} onPress={() => uploadEvidenceForRequest(String(r.id), String(it.code), "library")}>
                                <Text style={styles.actionText}>갤러리</Text>
                              </Pressable>
                              <Pressable disabled={actionApi.busy} style={[styles.actionButton, actionApi.busy && styles.actionButtonDisabled]} onPress={() => uploadEvidenceForRequest(String(r.id), String(it.code), "camera")}>
                                <Text style={styles.actionText}>카메라</Text>
                              </Pressable>
                              <Pressable disabled={actionApi.busy} style={[styles.actionButton, actionApi.busy && styles.actionButtonDisabled]} onPress={() => uploadPdfForRequest(String(r.id), String(it.code))}>
                                <Text style={styles.actionText}>PDF</Text>
                              </Pressable>
                            </View>
                          ) : (
                            <Text style={styles.itemMeta}>evidenceId: {it.evidenceId ? String(it.evidenceId) : "-"}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: S.lg,
    backgroundColor: T.paper,
  },
  banner: {
    borderWidth: 1,
    borderColor: T.accent,
    backgroundColor: T.accentSoft,
    borderRadius: R.r2,
    padding: S.md,
    marginBottom: S.md,
    flexDirection: "row",
    alignItems: "center",
    gap: S.sm + 2,
  },
  bannerText: {
    fontSize: FS.label,
    color: T.accentInk,
    fontWeight: FW.extrabold,
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
    fontSize: FS.title,
    fontWeight: FW.extrabold,
    color: T.ink,
  },
  metaRow: {
    marginTop: S.sm,
  },
  meta: {
    fontSize: FS.label,
    color: T.graphite,
    marginTop: S.xs,
  },
  sectionTitle: {
    fontSize: FS.body,
    fontWeight: FW.extrabold,
    color: T.ink,
    marginBottom: S.sm - 2,
  },
  body: {
    fontSize: FS.body,
    color: T.graphite,
    lineHeight: BH.sm - 2,
  },
  rowCard: {
    borderWidth: 1,
    borderColor: T.hairline,
    backgroundColor: T.paper,
    borderRadius: R.r2,
    padding: S.md,
  },
  rowTitle: {
    fontSize: FS.body,
    fontWeight: FW.extrabold,
    color: T.ink,
  },
  rowMeta: {
    marginTop: S.xs,
    fontSize: FS.sm,
    color: T.slate,
  },
  cancelButton: {
    height: BH.default,
    borderRadius: R.r2,
    borderWidth: 1,
    borderColor: T.dangerSoft,
    backgroundColor: T.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: T.danger,
    fontWeight: FW.extrabold,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: T.hairline,
    backgroundColor: T.canvas,
    borderRadius: R.r2,
    padding: S.md,
  },
  itemTitle: {
    fontSize: FS.label,
    fontWeight: FW.extrabold,
    color: T.ink,
  },
  itemMeta: {
    marginTop: S.xs,
    fontSize: FS.sm,
    color: T.slate,
  },
  actionButton: {
    flex: 1,
    height: BH.sm + 6,
    borderRadius: R.r2,
    borderWidth: 1,
    borderColor: T.accent,
    backgroundColor: T.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    color: T.accentInk,
    fontWeight: FW.extrabold,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
});
