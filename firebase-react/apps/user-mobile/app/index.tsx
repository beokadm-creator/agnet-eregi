import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import auth from "@react-native-firebase/auth";
import * as GoogleSignIn from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged((u: any) => {
      if (u) {
        router.replace("/(tabs)/home");
        return;
      }
      setReady(true);
    });
    return () => unsub();
  }, []);

  async function signInWithGoogle() {
    setBusy(true);
    try {
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      if (!webClientId) throw new Error("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID 환경변수가 필요합니다.");
      GoogleSignIn.GoogleSignin.configure({ webClientId });

      await GoogleSignIn.GoogleSignin.hasPlayServices();
      await GoogleSignIn.GoogleSignin.signIn();
      const tokens = await GoogleSignIn.GoogleSignin.getTokens();
      const idToken = (tokens as any)?.idToken;
      if (!idToken) throw new Error("Google idToken을 가져오지 못했습니다.");

      const credential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(credential);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("로그인 실패", e?.message || "Unknown failure");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithApple() {
    setBusy(true);
    try {
      const bytes = await Crypto.getRandomBytesAsync(16);
      const rawNonce = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error("Apple identityToken을 가져오지 못했습니다.");
      const appleCredential = auth.AppleAuthProvider.credential(credential.identityToken, rawNonce);
      await auth().signInWithCredential(appleCredential);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") return;
      Alert.alert("로그인 실패", e?.message || "Unknown failure");
    } finally {
      setBusy(false);
    }
  }

  async function signInAsGuest() {
    setBusy(true);
    try {
      await auth().signInAnonymously();
      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("로그인 실패", e?.message || "Unknown failure");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AgentRegi</Text>
      <Text style={styles.subtitle}>로그인 후 내 사건을 확인하세요.</Text>

      <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={signInWithGoogle} disabled={busy}>
        <Text style={styles.buttonText}>Google 로그인</Text>
      </Pressable>

      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={8}
        style={{ width: "100%", height: 48, marginTop: 12 }}
        onPress={busy ? () => {} : signInWithApple}
      />

      <Pressable style={[styles.buttonSecondary, busy && styles.buttonDisabled]} onPress={signInAsGuest} disabled={busy}>
        <Text style={styles.buttonTextSecondary}>게스트로 시작</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 10,
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    color: "#475569",
    textAlign: "center",
  },
  button: {
    width: "100%",
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  buttonSecondary: {
    width: "100%",
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  buttonTextSecondary: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16,
  },
});
