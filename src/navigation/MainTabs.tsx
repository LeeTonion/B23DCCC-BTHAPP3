import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { ChatListScreen } from '../screens/ChatListScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useChatData } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { unreadCount } from '../services/chat';
import { colors } from '../theme/colors';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const chatIcon = ({ color, focused }: { color: string; focused: boolean }) => (
  <Ionicons
    name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
    size={24}
    color={color}
  />
);

const contactIcon = ({ color, focused }: { color: string; focused: boolean }) => (
  <Ionicons
    name={focused ? 'people' : 'people-outline'}
    size={24}
    color={color}
  />
);

const settingsIcon = ({ color, focused }: { color: string; focused: boolean }) => (
  <Ionicons
    name={focused ? 'settings' : 'settings-outline'}
    size={24}
    color={color}
  />
);

export function MainTabs() {
  const { chats } = useChatData();
  const { user } = useAuth();
  const unread = Object.values(chats).reduce(
    (n, c) => n + unreadCount(c, user!.uid),
    0,
  );

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#64748B',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          paddingBottom: 4,
          letterSpacing: 0.3,
        },
        tabBarStyle: {
          backgroundColor: '#0C1322',
          borderTopColor: '#1E293B',
          borderTopWidth: 1,
          elevation: 12,
          shadowColor: '#00F0FF',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          height: 60,
          paddingTop: 6,
        },
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatListScreen}
        options={{
          title: 'Đoạn chat',
          headerShown: false,
          tabBarBadge: unread || undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: '#060A12',
            fontSize: 11,
            fontWeight: '900',
          },
          tabBarIcon: chatIcon,
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ChatListScreen}
        options={{
          title: 'Danh bạ',
          headerShown: false,
          tabBarIcon: contactIcon,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Cài đặt',
          headerShown: false,
          tabBarIcon: settingsIcon,
        }}
      />
    </Tab.Navigator>
  );
}
