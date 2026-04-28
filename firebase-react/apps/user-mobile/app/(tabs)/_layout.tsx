import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#4f46e5', // indigo-600
      tabBarInactiveTintColor: '#94a3b8',
      headerShown: true 
    }}>
      <Tabs.Screen 
        name="home" 
        options={{ 
          title: '홈',
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
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={24} color={color} />
        }} 
      />
    </Tabs>
  );
}
