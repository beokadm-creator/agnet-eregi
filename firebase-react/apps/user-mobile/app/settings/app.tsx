import { StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";

export default function AppInfoScreen() {
  const expoConfig: any = (Constants as any).expoConfig || {};
  const easConfig: any = (Constants as any).easConfig || {};
  const appVersion = expoConfig.version || "-";
  const buildNumber = expoConfig.ios?.buildNumber || expoConfig.android?.versionCode || "-";
  const runtimeVersion = expoConfig.runtimeVersion || "-";
  const projectId = expoConfig.extra?.eas?.projectId || easConfig.projectId || "-";

  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>앱 정보</Text>
        <Text style={styles.row}>version: {String(appVersion)}</Text>
        <Text style={styles.row}>build: {String(buildNumber)}</Text>
        <Text style={styles.row}>runtimeVersion: {String(runtimeVersion)}</Text>
        <Text style={styles.row}>projectId: {String(projectId)}</Text>
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

