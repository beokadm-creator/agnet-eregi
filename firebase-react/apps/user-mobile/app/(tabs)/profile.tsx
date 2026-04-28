import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import auth from "@react-native-firebase/auth";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { getApiBaseUrl } from "../../lib/apiBase";

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
  linkRow: {
    marginTop: 20,
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
  linkLabel: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "700",
  },
  linkValue: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "800",
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
