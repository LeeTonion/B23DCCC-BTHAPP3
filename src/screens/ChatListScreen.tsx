import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { Avatar } from '../components/Avatar';
import { MessageStatus } from '../components/MessageStatus';
import { useAuth } from '../context/AuthContext';
import { useChatData } from '../context/ChatContext';
import { conversationId, unreadCount } from '../services/chat';
import {
  deliveryState,
  lastMessageText,
  listTime,
  mergedMessages,
} from '../services/delivery';
import type { MainTabScreenProps } from '../navigation/types';
import { colors } from '../theme/colors';
export function ChatListScreen({
  navigation,
  route,
}: MainTabScreenProps<'Chats'> | MainTabScreenProps<'Contacts'>) {
  const contacts = route.name === 'Contacts';
  const { user, presenceError } = useAuth();
  const { users, presence, chats, error, loading, outbox, connected } =
    useChatData();
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const uid = user!.uid;
  const ownName = users[uid]?.name || user?.displayName || 'Bạn';
  const allRows = useMemo(
    () =>
      Object.entries(users)
        .filter(([key]) => key !== uid)
        .map(([key, p]) => {
          const id = conversationId(uid, key);
          const chat = chats[id];
          const last = mergedMessages(chat, id, outbox).at(-1);
          return {
            uid: key,
            id,
            name: p.name,
            online: Object.values(presence[key] || {}).some(Boolean),
            chat,
            last,
            unread: chat ? unreadCount(chat, uid) : 0,
          };
        }),
    [users, uid, chats, outbox, presence],
  );
  const rows = allRows
    .filter(
      r =>
        r.name
          .toLocaleLowerCase('vi')
          .includes(search.trim().toLocaleLowerCase('vi')) &&
        (contacts || r.last) &&
        (!unreadOnly || contacts || r.unread > 0),
    )
    .sort((a, b) =>
      contacts
        ? a.name.localeCompare(b.name, 'vi')
        : (b.last?.[1].createdAt || 0) - (a.last?.[1].createdAt || 0),
    );
  const activePeople = allRows.filter(r => r.online);
  const unreadTotal = allRows.reduce((total, r) => total + r.unread, 0);
  function open(peerId: string, name: string) {
    navigation.navigate('ChatDetail', { peerId, name });
  }
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở cài đặt tài khoản"
          onPress={() => navigation.navigate('Settings')}
        >
          <Avatar name={ownName} size={40} />
        </Pressable>
        <Text style={styles.heading}>{contacts ? 'Danh bạ' : 'Đoạn chat'}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            contacts ? 'Xem các cuộc trò chuyện' : 'Tạo cuộc trò chuyện'
          }
          style={styles.headerAction}
          onPress={() => navigation.navigate(contacts ? 'Chats' : 'Contacts')}
        >
          <Ionicons
            name={contacts ? 'chatbubbles-outline' : 'create-outline'}
            size={23}
            color={colors.text}
          />
        </Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={r => r.uid}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={21} color={colors.textMuted} />
              <TextInput
                accessibilityLabel="Tìm kiếm người dùng"
                style={styles.searchInput}
                placeholder={contacts ? 'Tìm bạn bè' : 'Tìm kiếm'}
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
              {!!search && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xóa tìm kiếm"
                  hitSlop={8}
                  onPress={() => setSearch('')}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              )}
            </View>
            {(!connected || !!error || !!presenceError) && (
              <View style={styles.notice}>
                <Ionicons
                  name={
                    error ? 'alert-circle-outline' : 'cloud-offline-outline'
                  }
                  size={18}
                  color={colors.textMuted}
                />
                <Text style={styles.noticeText}>
                  {error ||
                    presenceError ||
                    'Đang kết nối lại. Tin nhắn sẽ gửi khi có mạng.'}
                </Text>
              </View>
            )}
            {!contacts && !search && activePeople.length > 0 && (
              <View style={styles.activeSection}>
                <Text style={styles.sectionLabel}>Đang hoạt động</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.people}
                >
                  {activePeople.map(person => (
                    <Pressable
                      key={person.uid}
                      style={styles.person}
                      accessibilityRole="button"
                      accessibilityLabel={`Nhắn tin với ${person.name}`}
                      onPress={() => open(person.uid, person.name)}
                    >
                      <Avatar name={person.name} size={60} online />
                      <Text numberOfLines={1} style={styles.personName}>
                        {person.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            {contacts ? (
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionLabel}>MỌI NGƯỜI</Text>
                <Text style={styles.count}>{allRows.length} người bạn</Text>
              </View>
            ) : (
              <View style={styles.filters}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: !unreadOnly }}
                  onPress={() => setUnreadOnly(false)}
                  style={[styles.filter, !unreadOnly && styles.filterActive]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      !unreadOnly && styles.filterTextActive,
                    ]}
                  >
                    Tất cả
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: unreadOnly }}
                  onPress={() => setUnreadOnly(true)}
                  style={[styles.filter, unreadOnly && styles.filterActive]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      unreadOnly && styles.filterTextActive,
                    ]}
                  >
                    Chưa đọc{unreadTotal > 0 ? ` (${unreadTotal})` : ''}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.emptyBody}>Đang tải cuộc trò chuyện…</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={contacts ? 'people-outline' : 'chatbubbles-outline'}
                  size={34}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {search
                  ? 'Không tìm thấy người dùng'
                  : unreadOnly && !contacts
                  ? 'Bạn đã đọc hết tin nhắn'
                  : contacts
                  ? 'Bạn bè sẽ xuất hiện ở đây'
                  : 'Bắt đầu cuộc trò chuyện'}
              </Text>
              <Text style={styles.emptyBody}>
                {search
                  ? 'Thử tìm bằng một tên khác.'
                  : contacts
                  ? 'Đăng ký một tài khoản khác trên thiết bị thứ hai để kết nối.'
                  : 'Chọn một người trong danh bạ và gửi lời chào.'}
              </Text>
              {!contacts && !unreadOnly && !search && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('Contacts')}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>Mở danh bạ</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={17}
                    color={colors.primary}
                  />
                </Pressable>
              )}
            </View>
          )
        }
        renderItem={({ item }) => {
          const last = item.last?.[1];
          const key = item.last?.[0];
          const outgoing = !!last && last.senderId === uid;
          const state = key
            ? deliveryState(key, item.chat?.read?.[item.uid], outbox[key])
            : 'sent';
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${
                item.unread
                  ? `${item.unread} tin chưa đọc`
                  : contacts
                  ? item.online
                    ? 'Đang hoạt động'
                    : 'Không hoạt động'
                  : last
                  ? lastMessageText(last, uid, item.name)
                  : ''
              }`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => open(item.uid, item.name)}
            >
              <Avatar name={item.name} size={64} online={item.online} />
              <View style={styles.info}>
                <View style={styles.line}>
                  <Text
                    numberOfLines={1}
                    style={[styles.name, item.unread > 0 && styles.unreadName]}
                  >
                    {item.name}
                  </Text>
                  {!contacts && last && (
                    <Text
                      style={[
                        styles.time,
                        item.unread > 0 && styles.unreadText,
                      ]}
                    >
                      {listTime(last.createdAt)}
                    </Text>
                  )}
                </View>
                <View style={styles.previewLine}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.preview,
                      item.unread > 0 && styles.unreadText,
                      state === 'failed' && outgoing && styles.failed,
                    ]}
                  >
                    {contacts
                      ? item.online
                        ? 'Đang hoạt động'
                        : 'Không hoạt động'
                      : last
                      ? state === 'failed' && outgoing
                        ? 'Bạn: Gửi thất bại — nhấn để thử lại'
                        : lastMessageText(last, uid, item.name)
                      : ''}
                  </Text>
                  {!contacts &&
                    (item.unread > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {item.unread > 99 ? '99+' : item.unread}
                        </Text>
                      </View>
                    ) : outgoing ? (
                      <MessageStatus
                        state={state}
                        peerName={item.name}
                        compact
                      />
                    ) : null)}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  heading: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    flex: 1,
    letterSpacing: -0.5,
  },
  headerAction: {
    height: 42,
    width: 42,
    borderRadius: 21,
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  list: { paddingBottom: 24, flexGrow: 1 },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 46,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 10,
  },
  notice: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  activeSection: {
    paddingTop: 6,
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00F0FF',
    marginHorizontal: 18,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  people: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 12 },
  person: { width: 72, alignItems: 'center', gap: 6 },
  personName: { fontSize: 12, color: '#F8FAFC', maxWidth: 72, textAlign: 'center', fontWeight: '500' },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  filter: {
    paddingHorizontal: 16,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  filterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  filterText: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  filterTextActive: { color: '#060A12' },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  count: { marginRight: 18, color: '#64748B', fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    minHeight: 80,
    backgroundColor: '#111827',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  pressed: { backgroundColor: '#1A243B', borderColor: 'rgba(0, 240, 255, 0.4)' },
  info: { flex: 1, gap: 5 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  unreadName: { fontWeight: '900', color: '#00F0FF' },
  time: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  previewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 20,
  },
  preview: { flex: 1, fontSize: 13.5, color: '#94A3B8', lineHeight: 19 },
  unreadText: { fontWeight: '700', color: '#F8FAFC' },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeText: { fontSize: 11, color: '#060A12', fontWeight: '900' },
  failed: { color: colors.danger },
  empty: { padding: 36, paddingTop: 64, alignItems: 'center', gap: 12 },
  emptyIcon: {
    height: 76,
    width: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyButton: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 14,
  },
  emptyButtonText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});
