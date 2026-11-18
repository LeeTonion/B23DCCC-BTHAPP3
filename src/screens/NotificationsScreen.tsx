import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useChatData } from '../context/ChatContext';
import {
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../services/notificationService';
import { listTime } from '../services/delivery';
import type { MainTabScreenProps } from '../navigation/types';
import { colors } from '../theme/colors';

export function NotificationsScreen({
  navigation,
}: MainTabScreenProps<'Notifications'>) {
  const { user } = useAuth();
  const { notifications, users, chats } = useChatData();
  const uid = user!.uid;

  const items = useMemo(() => {
    return Object.entries(notifications)
      .map(([id, item]) => ({ id, ...item }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [notifications]);

  const unreadIds = useMemo(
    () => items.filter(i => !i.read).map(i => i.id),
    [items],
  );

  function openNotification(item: NotificationItem & { id: string }) {
    if (!item.read) {
      markNotificationRead(uid, item.id).catch(() => {});
    }
    const conv = chats[item.convId];
    const isGroup = conv?.type === 'group';
    if (isGroup) {
      navigation.navigate('ChatDetail', {
        convId: item.convId,
        name: conv?.name || 'Nhóm chat',
        isGroup: true,
      });
      return;
    }
    const peerId =
      Object.keys(conv?.members || {}).find(id => id !== uid) || item.fromUid;
    const peerName = users[peerId]?.name || 'Cuộc trò chuyện';
    navigation.navigate('ChatDetail', {
      convId: item.convId,
      peerId,
      name: peerName,
      isGroup: false,
    });
  }

  function iconName(type: NotificationItem['type']) {
    switch (type) {
      case 'group_add':
        return 'people';
      case 'reaction':
        return 'heart';
      default:
        return 'chatbubble-ellipses';
    }
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.heading}>Thông báo</Text>
        {unreadIds.length > 0 && (
          <Pressable
            accessibilityRole="button"
            style={styles.markAllBtn}
            onPress={() =>
              markAllNotificationsRead(uid, unreadIds).catch(() => {})
            }
          >
            <Ionicons
              name="checkmark-done"
              size={17}
              color={colors.primary}
            />
            <Text style={styles.markAllText}>Đánh dấu tất cả đã đọc</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="notifications-outline"
                size={34}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>Chưa có thông báo nào</Text>
            <Text style={styles.emptyBody}>
              Tin nhắn mới, lời mời vào nhóm hoặc cảm xúc sẽ hiển thị tại đây.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const sender = users[item.fromUid];
          return (
            <Pressable
              style={[styles.row, !item.read && styles.unreadRow]}
              onPress={() => openNotification(item)}
            >
              <View style={styles.avatarWrap}>
                <Avatar
                  name={sender?.name || 'Hệ thống'}
                  avatarUrl={sender?.avatarUrl}
                  size={52}
                />
                <View style={styles.typeBadge}>
                  <Ionicons
                    name={iconName(item.type)}
                    size={12}
                    color="#FFFFFF"
                  />
                </View>
              </View>
              <View style={styles.info}>
                <Text
                  style={[styles.text, !item.read && styles.unreadText]}
                  numberOfLines={2}
                >
                  {item.text}
                </Text>
                <Text style={styles.time}>
                  {item.createdAt ? listTime(item.createdAt) : ''}
                </Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.softBlue,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  markAllText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  list: { paddingBottom: 24, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  unreadRow: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  avatarWrap: { position: 'relative' },
  typeBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 4 },
  text: { fontSize: 14, color: colors.text, lineHeight: 20 },
  unreadText: { fontWeight: '700' },
  time: { fontSize: 11.5, color: colors.textMuted },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  empty: { padding: 36, paddingTop: 72, alignItems: 'center', gap: 12 },
  emptyIcon: {
    height: 76,
    width: 76,
    borderRadius: 38,
    backgroundColor: colors.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  emptyBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
});
