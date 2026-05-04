import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import auth from "@react-native-firebase/auth";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { getApiBaseUrl } from "../../lib/apiBase";
import { T, R, S, FS, FW, BH } from '../../lib/tokens';

export default function ProfileScreen() {
  const handleLogout = async () => {
    try {
      const user = auth().currentUser;
      if (user) {
        const { status } = await Notifications.getPermissionsAsync();
        if (status === "granted") {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
          const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : (undefined as any))).data;
          if (token) {
            const idToken = await user.getIdToken();
            await fetch(`${getApiBaseUrl()}/v1/user/push-tokens`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ token }),
            }).catch(() => {});
          }
        }
      }
    } catch {}
    await auth().signOut();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>내 프로필</Text>
      <Text style={styles.description}>{auth().currentUser?.email || auth().currentUser?.uid}</Text>

      <Pressable style={styles.linkRow} onPress={() => router.push("/settings")}>
        <Text style={styles.linkLabel}>알림 설정</Text>
        <Text style={styles.linkValue}>열기</Text>
      </Pressable>
      
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
    padding: S.lg,
    backgroundColor: T.paper,
  },
  title: {
    fontSize: FS.h3,
    fontWeight: FW.bold,
    color: T.ink,
    marginBottom: S.sm,
  },
  description: {
    fontSize: FS.md,
    color: T.graphite,
  },
  linkRow: {
    marginTop: S.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: S.md,
    paddingHorizontal: S.md,
    borderWidth: 1,
    borderColor: T.hairline,
    backgroundColor: T.canvas,
    borderRadius: R.r2,
  },
  linkLabel: {
    fontSize: FS.body,
    color: T.ink,
    fontWeight: FW.bold,
  },
  linkValue: {
    fontSize: FS.body,
    color: T.graphite,
    fontWeight: FW.extrabold,
  },
  buttonContainer: {
    marginTop: S.xxxl,
    borderRadius: R.r1,
    overflow: 'hidden',
  },
  logoutButton: {
    height: BH.default,
    borderRadius: R.r2,
    backgroundColor: T.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: T.canvas,
    fontWeight: FW.extrabold,
  },
});
