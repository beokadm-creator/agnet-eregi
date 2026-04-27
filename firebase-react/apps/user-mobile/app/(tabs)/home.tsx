import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>내 사건 현황</Text>
      <Text style={styles.description}>현재 진행 중인 1건의 케이스가 있습니다.</Text>
      {/* TODO: 여기에 미니 대시보드나 빠른 액션 버튼들을 추가합니다. */}
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
  }
});