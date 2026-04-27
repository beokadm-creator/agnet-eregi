import { View, Text, StyleSheet } from 'react-native';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export default function HomeScreen() {
  const { expoPushToken } = usePushNotifications();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>내 사건 현황</Text>
      <Text style={styles.description}>현재 진행 중인 1건의 케이스가 있습니다.</Text>
      
      <View style={styles.tokenContainer}>
        <Text style={styles.tokenTitle}>푸시 알림 토큰:</Text>
        <Text style={styles.tokenText}>{expoPushToken || '권한 요청 중...'}</Text>
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
  tokenContainer: {
    marginTop: 40,
    padding: 16,
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
  },
  tokenTitle: {
    fontWeight: 'bold',
    color: '#3730a3',
    marginBottom: 4,
  },
  tokenText: {
    fontSize: 12,
    color: '#4338ca',
  }
});