import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

export default function SettingsIndex() {
  return (
    <View style={styles.container}>
      <Pressable style={styles.row} onPress={() => router.push("/settings/notifications")}>
        <Text style={styles.label}>알림 설정</Text>
        <Text style={styles.value}>열기</Text>
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
});

