import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';

export default function CasesScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const pickImageAsync = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    } else {
      Alert.alert('취소', '이미지 선택을 취소했습니다.');
    }
  };

  const takePhotoAsync = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>내 사건 목록</Text>
      <Text style={styles.description}>업로드해야 할 서류가 2개 있습니다.</Text>
      
      <View style={styles.uploadSection}>
        <Text style={styles.sectionTitle}>신분증 업로드</Text>
        {selectedImage ? (
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />
        ) : (
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderText}>이미지가 없습니다.</Text>
          </View>
        )}
        <View style={styles.buttonRow}>
          <Button title="갤러리에서 선택" onPress={pickImageAsync} />
          <Button title="카메라로 촬영" onPress={takePhotoAsync} />
        </View>
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
    color: '#eab308',
    fontWeight: '500'
  },
  uploadSection: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1e293b'
  },
  placeholderBox: {
    height: 200,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    color: '#64748b',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  }
});