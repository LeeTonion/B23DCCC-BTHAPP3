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
import { useAuth } from '../context/AuthContext';
import { useChatData } from '../context/ChatContext';
import { conversationId } from '../services/chat';
import { listTime } from '../services/delivery';
import type { MainTabScreenProps } from '../navigation/types';
import { colors } from '../theme/colors';

interface RowItem {
  key: string;
  convId: string;
  peerId?: string;
  name: string;
  avatarUrl?: string;
  isGroup: boolean;
  online: boolean;
  lastMessage: string;
  lastSenderId?: string;
  updatedAt: number;
  unread: number;
}

export function ChatListScreen({
  navigation,
  route,
}: MainTabScreenProps<'Chats'> | MainTabScreenProps<'Contacts'>) {
  const contacts = route.name === 'Contacts';
  const { user, presenceError } = useAuth();
  const {
    users,
    presence,
    chats,
    userChats,
    error,
    loading,
    connected,
  } = useChatData();
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const uid = user!.uid;
  const ownProfile = users[uid];
  const ownName = ownProfile?.name || user?.displayName || 'Bạn';

  const contactRows = useMemo<RowItem[]>(() => {
    return Object.entries(users)
      .filter(([key]) => key !== uid)
      .map(([key, p]) => ({
        key,
        convId: conversationId(uid, key),
        peerId: key,
        name: p.name,
        avatarUrl: p.avatarUrl,
        isGroup: false,
        online: Object.values(presence[key] || {}).some(Boolean),
        lastMessage: '',
        updatedAt: 0,
        unread: 0,
      }));
  }, [users, uid, presence]);

  const chatRows = useMemo<RowItem[]>(() => {
    return Object.entries(userChats).map(([convId, uc]) => {
      const conv = chats[convId];
      const isGroup = conv?.type === 'group';
      if (isGroup) {
        const memberIds = Object.keys(conv?.members || {}).filter(
          id => id !== uid,
        );
        const online = memberIds.some(id =>
          Object.values(presence[id] || {}).some(Boolean),
        );
        return {
          key: convId,
          convId,
          name: conv?.name || 'Nhóm chat',
          isGroup: true,
          online,
          lastMessage: uc.lastMessage || '',
          lastSenderId: uc.lastSenderId,
          updatedAt: uc.updatedAt || 0,
          unread: uc.unread || 0,
        };
      }
      const peerId =
        Object.keys(conv?.members || {}).find(id => id !== uid) ||
        convId.split('_').find(id => id !== uid) ||
        '';
      const peer = users[peerId];
      return {
        key: convId,
        convId,
        peerId,
        name: peer?.name || 'Người dùng',
        avatarUrl: peer?.avatarUrl,
        isGroup: false,
        online: Object.values(presence[peerId] || {}).some(Boolean),
        lastMessage: uc.lastMessage || '',
        lastSenderId: uc.lastSenderId,
        updatedAt: uc.updatedAt || 0,
        unread: uc.unread || 0,
      };
    });
  }, [userChats, chats, uid, users, presence]);

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi');
    if (contacts) {
      return contactRows
        .filter(r => r.name.toLocaleLowerCase('vi').includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }
    return chatRows
      .filter(
        r =>
          r.name.toLocaleLowerCase('vi').includes(q) &&
          (!unreadOnly || r.unread > 0),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [contacts, contactRows, chatRows, search, unreadOnly]);

  const activePeople = contactRows.filter(r => r.online);
  const unreadTotal = chatRows.reduce((total, r) => total + r.unread, 0);

  function open(item: RowItem) {
    navigation.navigate('ChatDetail', {
      convId: item.convId,
      peerId: item.peerId,
      name: item.name,
      isGroup: item.isGroup,
    });
  }

  function formatPreview(item: RowItem) {
    if (!item.lastMessage) {
      return '';
    }
    if (item.lastSenderId === uid) {
      return `Bạn: ${item.lastMessage}`;
    }
    if (item.isGroup && item.lastSenderId && users[item.lastSenderId]?.name) {
      return `${users[item.lastSenderId].name}: ${item.lastMessage}`;
    }
    return item.lastMessage;
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở cài đặt tài khoản"
          onPress={() => navigation.navigate('Settings')}
        >
          <Avatar
            name={ownName}
            avatarUrl={ownProfile?.avatarUrl}
            size={40}
          />
        </Pressable>
        <Text style={styles.heading}>{contacts ? 'Danh bạ' : 'Đoạn chat'}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tạo nhóm mới"
          style={styles.headerAction}
          onPress={() => navigation.navigate('CreateGroup')}
        >
          <Ionicons name="people-outline" size={22} color={colors.primary} />
        </Pressable>
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
        keyExtractor={r => r.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={21} color={colors.textMuted} />
              <TextInput
                accessibilityLabel="Tìm kiếm"
                style={styles.searchInput}
                placeholder={contacts ? 'Tìm bạn bè' : 'Tìm kiếm cuộc trò chuyện'}
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
                      key={person.key}
                      style={styles.person}
                      accessibilityRole="button"
                      accessibilityLabel={`Nhắn tin với ${person.name}`}
                      onPress={() => open(person)}
                    >
                      <Avatar
                        name={person.name}
                        avatarUrl={person.avatarUrl}
                        size={60}
                        online
                      />
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
                <Text style={styles.count}>{contactRows.length} người bạn</Text>
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
                  ? 'Không tìm thấy kết quả'
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
                  : 'Chọn một người trong danh bạ hoặc tạo nhóm chat mới.'}
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
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => open(item)}
          >
            <Avatar
              name={item.name}
              avatarUrl={item.avatarUrl}
              size={60}
              online={item.online}
            />
            <View style={styles.info}>
              <View style={styles.line}>
                <View style={styles.titleWrap}>
                  {item.isGroup && (
                    <Ionicons
                      name="people"
                      size={15}
                      color={colors.primary}
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text
                    numberOfLines={1}
                    style={[styles.name, item.unread > 0 && styles.unreadName]}
                  >
                    {item.name}
                  </Text>
                </View>
                {!contacts && item.updatedAt > 0 && (
                  <Text
                    style={[
                      styles.time,
                      item.unread > 0 && styles.unreadText,
                    ]}
                  >
                    {listTime(item.updatedAt)}
                  </Text>
                )}
              </View>
              <View style={styles.previewLine}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.preview,
                    item.unread > 0 && styles.unreadText,
                  ]}
                >
                  {contacts
                    ? item.online
                      ? 'Đang hoạt động'
                      : 'Không hoạt động'
                    : formatPreview(item)}
                </Text>
                {!contacts && item.unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {item.unread > 99 ? '99+' : item.unread}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
    letterSpacing: -0.5,
  },
  headerAction: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  list: { paddingBottom: 24, flexGrow: 1 },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 46,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  activeSection: { paddingTop: 6, marginBottom: 6 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginHorizontal: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  people: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 12 },
  person: { width: 72, alignItems: 'center', gap: 6 },
  personName: {
    fontSize: 12,
    color: colors.text,
    maxWidth: 72,
    textAlign: 'center',
    fontWeight: '500',
  },
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: '#FFFFFF' },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  count: {
    marginRight: 18,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    minHeight: 78,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 1,
  },
  pressed: { backgroundColor: colors.softBlue, opacity: 0.9 },
  info: { flex: 1, gap: 5 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: colors.text, flexShrink: 1 },
  unreadName: { fontWeight: '800', color: colors.text },
  time: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  previewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 20,
  },
  preview: {
    flex: 1,
    fontSize: 13.5,
    color: colors.textMuted,
    lineHeight: 19,
  },
  unreadText: { fontWeight: '700', color: colors.text },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, color: '#FFFFFF', fontWeight: '800' },
  empty: { padding: 36, paddingTop: 64, alignItems: 'center', gap: 12 },
  emptyIcon: {
    height: 76,
    width: 76,
    borderRadius: 38,
    backgroundColor: colors.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textMuted,
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
