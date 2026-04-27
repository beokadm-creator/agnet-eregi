import { View, Text, Button, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const handleLogout = () => {
    // 로그아웃 시 초기 인증 화면으로 돌아감
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>내 프로필</Text>
      <Text style={styles.description}>홍길동 님</Text>
      
      <View style={styles.buttonContainer}>
        <Button title="로그아웃" onPress={handleLogout} color="#ef4444" />
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
  buttonContainer: {
    marginTop: 40,
    borderRadius: 8,
    overflow: 'hidden',
  }
});