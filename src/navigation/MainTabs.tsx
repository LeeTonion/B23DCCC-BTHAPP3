import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { ChatListScreen } from '../screens/ChatListScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useChatData } from '../context/ChatContext';
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

const notifIcon = ({ color, focused }: { color: string; focused: boolean }) => (
  <Ionicons
    name={focused ? 'notifications' : 'notifications-outline'}
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
  const { userChats, notifications } = useChatData();
  const unread = Object.values(userChats).reduce(
    (n, c) => n + (c.unread || 0),
    0,
  );
  const unreadNotifs = Object.values(notifications).filter(n => !n.read).length;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          paddingBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
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
            fontSize: 11,
            fontWeight: '700',
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
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Thông báo',
          headerShown: false,
          tabBarBadge: unreadNotifs || undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.danger,
            fontSize: 11,
            fontWeight: '700',
          },
          tabBarIcon: notifIcon,
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
