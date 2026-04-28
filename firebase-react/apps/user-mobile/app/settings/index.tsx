import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import auth from "@react-native-firebase/auth";
import { useApi } from "../../hooks/useApi";
import { usePushNotifications } from "../../hooks/usePushNotifications";

export default function SettingsIndex() {
  const { busy, callApi } = useApi();
  const { expoPushToken } = usePushNotifications();

  return (
    <View style={styles.container}>
      <View style={styles.group}>
        <Pressable style={styles.row} onPress={() => router.push("/settings/notifications")}>
          <Text style={styles.label}>알림 설정</Text>
          <Text style={styles.value}>열기</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => router.push("/settings/devices")}>
          <Text style={styles.label}>기기 관리</Text>
          <Text style={styles.value}>열기</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => router.push("/settings/account")}>
          <Text style={styles.label}>계정</Text>
          <Text style={styles.value}>열기</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => router.push("/settings/app")}>
          <Text style={styles.label}>앱 정보</Text>
          <Text style={styles.value}>열기</Text>
        </Pressable>
      </View>

      <View style={styles.group}>
        <Pressable
          disabled={busy}
          style={[styles.row, styles.dangerRow, busy && styles.rowDisabled]}
          onPress={async () => {
            try {
              if (expoPushToken && expoPushToken.includes("PushToken[")) {
                await callApi("/v1/user/push-tokens", { method: "DELETE", body: JSON.stringify({ token: expoPushToken }) });
              }
            } catch {}
            await auth().signOut();
            router.replace("/");
          }}
        >
          <Text style={[styles.label, styles.dangerText]}>로그아웃</Text>
          {busy ? <ActivityIndicator /> : <Text style={[styles.value, styles.dangerText]}>실행</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8fafc",
  },
  group: {
    gap: 10,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "700",
  },
  value: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "800",
  },
  dangerRow: {
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
  },
  dangerText: {
    color: "#b91c1c",
  },
});
