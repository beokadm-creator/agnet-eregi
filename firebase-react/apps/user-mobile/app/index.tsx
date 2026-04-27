import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';

export default function AuthScreen() {
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);
    })();
  }, []);

  const handleAuth = async () => {
    try {
      const biometricAuth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'AgentRegi 생체 인증',
        disableDeviceFallback: false,
      });
      if (biometricAuth.success) {
        // 인증 성공 시 탭 기반 메인 화면으로 이동
        router.replace('/(tabs)/home');
      } else {
        Alert.alert('실패', '인증이 취소되었거나 실패했습니다.');
      }
    } catch (error) {
      Alert.alert('에러', '인증 중 문제가 발생했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AgentRegi Mobile</Text>
      <Text style={styles.subtitle}>안전한 환경을 위해 인증해주세요.</Text>
      <Button 
        title={isBiometricSupported ? '생체 인증으로 로그인' : '로그인'} 
        onPress={handleAuth} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20 
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 10,
    color: '#1e293b'
  },
  subtitle: { 
    fontSize: 16, 
    marginBottom: 30, 
    color: '#64748b' 
  },
});