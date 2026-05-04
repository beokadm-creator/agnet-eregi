import { StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { T, R, S, FS, FW } from '../../lib/tokens';

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
    padding: S.lg,
    backgroundColor: T.paper,
  },
  panel: {
    borderWidth: 1,
    borderColor: T.hairline,
    backgroundColor: T.canvas,
    borderRadius: R.r2,
    padding: S.base,
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
});

