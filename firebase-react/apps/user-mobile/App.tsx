import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useState, useEffect } from 'react';

export default function App() {
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
        setIsAuthenticated(true);
        Alert.alert('성공', '생체 인증이 완료되었습니다.');
      } else {
        Alert.alert('실패', '인증이 취소되었거나 실패했습니다.');
      }
    } catch (error) {
      Alert.alert('에러', '인증 중 문제가 발생했습니다.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AgentRegi Mobile (MVP)</Text>
      
      {isAuthenticated ? (
        <Text style={styles.successText}>환영합니다! 안전한 환경에 접속되었습니다.</Text>
      ) : (
        <View style={styles.authContainer}>
          <Text style={styles.subtitle}>계속하려면 인증이 필요합니다.</Text>
          <Button 
            title={isBiometricSupported ? '생체 인증으로 로그인' : '로그인'} 
            onPress={handleAuth} 
          />
        </View>
      )}
      
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
  },
  authContainer: {
    alignItems: 'center',
  },
  successText: {
    fontSize: 18,
    color: '#2e7d32',
    fontWeight: 'bold',
  }
});