import { Tabs, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { T, S } from '../../lib/tokens';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: T.accent,
      tabBarInactiveTintColor: T.slate,
      headerShown: true 
    }}>
      <Tabs.Screen 
        name="home" 
        options={{ 
          title: '홈',
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings')} style={{ paddingHorizontal: S.md }}>
              <MaterialIcons name="settings" size={22} color={T.ink} />
            </Pressable>
          ),
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={24} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="cases" 
        options={{ 
          title: '내 사건',
          headerShown: false,
          tabBarIcon: ({ color }) => <MaterialIcons name="folder" size={24} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: '프로필',
          headerRight: () => (
            <Pressable onPress={() => router.push('/settings')} style={{ paddingHorizontal: S.md }}>
              <MaterialIcons name="settings" size={22} color={T.ink} />
            </Pressable>
          ),
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={24} color={color} />
        }} 
      />
    </Tabs>
  );
}
