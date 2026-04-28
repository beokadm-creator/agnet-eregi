import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useApi } from "../../../../../hooks/useApi";
import { T, R, S, FS, FW, BH } from '../../../../../lib/tokens';
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

function formatTs(ts: any): string {
  if (!ts) return "-";
  if (typeof ts === "string") return ts;
  if (typeof ts.toDate === "function") return ts.toDate().toLocaleString();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000).toLocaleString();
  return "-";
}

export default function EvidenceRequestDetail() {
  const { id, requestId } = useLocalSearchParams<{ id: string; requestId: string }>();
  const detailApi = useApi();
  const actionApi = useApi();
  const [uploadPhase, setUploadPhase] = useState<string>("");

  const evidenceRequest = detailApi.data?.evidenceRequest || null;

  useEffect(() => {
    if (!id || !requestId) return;
    detailApi.callApi(`/v1/user/submissions/${id}/evidence-requests/${requestId}`);
  }, [id, requestId]);

  function guessContentType(uri: string): string {
    const lower = (uri || "").toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".pdf")) return "application/pdf";
    return "image/jpeg";
  }

  async function uploadFromUri(itemCode: string, uri: string, filenameGuess: string) {
    if (!id || !requestId) return;
    setUploadPhase("파일 읽는 중");
    const fileRes = await fetch(uri);
    const blob = await fileRes.blob();
    const contentType = blob.type || guessContentType(uri);
    const sizeBytes = blob.size || 0;
    if (sizeBytes > 25 * 1024 * 1024) throw new Error("파일 크기는 25MB 이하여야 합니다.");
    if (!["application/pdf", "image/png", "image/jpeg", "image/jpg"].includes(contentType)) throw new Error("허용되지 않는 파일 형식입니다.");

    setUploadPhase("업로드 URL 발급");
    const initRes = await actionApi.callApi(`/v1/user/submissions/${id}/evidences/upload-url`, {
      method: "POST",
      body: JSON.stringify({
        filename: filenameGuess,
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
    await detailApi.callApi(`/v1/user/submissions/${id}/evidence-requests/${requestId}`);
  }

  async function uploadImage(itemCode: string, source: "library" | "camera") {
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
      await uploadFromUri(itemCode, asset.uri, filename);
    } catch (e: any) {
      Alert.alert("업로드 실패", e?.message || "Unknown failure");
    } finally {
      setUploadPhase("");
    }
  }

  async function uploadPdf(itemCode: string) {
    if (actionApi.busy) return;
    try {
      setUploadPhase("파일 선택");
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf"], multiple: false, copyToCacheDirectory: true });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      const filename = asset.name || asset.uri.split("/").pop() || `upload_${Date.now()}.pdf`;
      await uploadFromUri(itemCode, asset.uri, filename);
    } catch (e: any) {
      Alert.alert("업로드 실패", e?.message || "Unknown failure");
    } finally {
      setUploadPhase("");
    }
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
      {detailApi.busy && !evidenceRequest && <ActivityIndicator />}
      {!detailApi.busy && detailApi.error ? <Text style={{ color: T.danger }}>{detailApi.error}</Text> : null}

      {evidenceRequest && (
        <View style={styles.panel}>
          <Text style={styles.title}>보완 요청</Text>
          <Text style={styles.meta}>ID: {String(evidenceRequest.id)}</Text>
          <Text style={styles.meta}>status: {String(evidenceRequest.status)}</Text>
          <Text style={styles.meta}>createdAt: {formatTs(evidenceRequest.createdAt)}</Text>
          {evidenceRequest.messageToUserKo ? <Text style={[styles.body, { marginTop: 10 }]}>{String(evidenceRequest.messageToUserKo)}</Text> : null}

          {Array.isArray(evidenceRequest.items) ? (
            <View style={{ marginTop: 14, gap: 10 }}>
              {evidenceRequest.items.map((it: any) => {
                const open = String(it.status) === "open";
                return (
                  <View key={String(it.code)} style={styles.itemCard}>
                    <Text style={styles.itemTitle}>{it.titleKo || it.code}</Text>
                    <Text style={styles.itemMeta}>code: {String(it.code)} · status: {String(it.status)}</Text>
                    {open ? (
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                        <Pressable disabled={actionApi.busy} style={[styles.actionButton, actionApi.busy && styles.actionButtonDisabled]} onPress={() => uploadImage(String(it.code), "library")}>
                          <Text style={styles.actionText}>갤러리</Text>
                        </Pressable>
                        <Pressable disabled={actionApi.busy} style={[styles.actionButton, actionApi.busy && styles.actionButtonDisabled]} onPress={() => uploadImage(String(it.code), "camera")}>
                          <Text style={styles.actionText}>카메라</Text>
                        </Pressable>
                        <Pressable disabled={actionApi.busy} style={[styles.actionButton, actionApi.busy && styles.actionButtonDisabled]} onPress={() => uploadPdf(String(it.code))}>
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
        </View>
      )}
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
  },
  title: {
    fontSize: FS.subheading + 1,
    fontWeight: FW.extrabold,
    color: T.ink,
  },
  meta: {
    fontSize: FS.sm,
    color: T.slate,
    marginTop: S.xs,
  },
  body: {
    fontSize: FS.body,
    color: T.graphite,
    lineHeight: BH.sm - 2,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: T.hairline,
    backgroundColor: T.paper,
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
