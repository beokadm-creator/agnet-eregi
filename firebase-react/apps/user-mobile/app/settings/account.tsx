import { StyleSheet, Text, View } from "react-native";
import auth from "@react-native-firebase/auth";

export default function AccountSettingsScreen() {
  const user = auth().currentUser;
  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>현재 로그인</Text>
        <Text style={styles.row}>UID: {user?.uid || "-"}</Text>
        <Text style={styles.row}>Email: {user?.email || "-"}</Text>
        <Text style={styles.row}>Anonymous: {user?.isAnonymous ? "YES" : "NO"}</Text>
        <Text style={styles.row}>Provider: {user?.providerData?.map((p) => p.providerId).filter(Boolean).join(", ") || "-"}</Text>
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
  panel: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
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
});

