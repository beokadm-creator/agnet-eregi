import { View, Text, StyleSheet } from 'react-native';

export default function CasesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>내 사건 목록</Text>
      <Text style={styles.description}>업로드해야 할 서류가 2개 있습니다.</Text>
      {/* TODO: FlashList 등을 사용하여 케이스 및 서류 슬롯 리스트를 렌더링합니다. */}
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
    color: '#eab308', // yellow-500
    fontWeight: '500'
  }
});