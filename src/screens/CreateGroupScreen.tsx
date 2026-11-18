import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
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
import { createGroup } from '../services/groupService';
import { errorMessage } from '../services/firebase';
import type { RootStackScreenProps } from '../navigation/types';
import { colors } from '../theme/colors';

export function CreateGroupScreen({
  navigation,
}: RootStackScreenProps<'CreateGroup'>) {
  const { user } = useAuth();
  const { users, presence } = useChatData();
  const uid = user!.uid;
  const ownName = users[uid]?.name || user?.displayName || 'Bạn';

  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const contacts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi');
    return Object.entries(users)
      .filter(([id]) => id !== uid)
      .map(([id, profile]) => ({
        uid: id,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        online: Object.values(presence[id] || {}).some(Boolean),
      }))
      .filter(c => c.name.toLocaleLowerCase('vi').includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [users, uid, presence, search]);

  function toggleMember(memberUid: string) {
    setSelected(prev =>
      prev.includes(memberUid)
        ? prev.filter(id => id !== memberUid)
        : [...prev, memberUid],
    );
  }

  async function handleCreate() {
    if (creating) {
      return;
    }
    if (!groupName.trim()) {
      Alert.alert('Thiếu tên nhóm', 'Vui lòng nhập tên nhóm.');
      return;
    }
    if (selected.length < 2) {
      Alert.alert(
        'Chưa đủ thành viên',
        'Vui lòng chọn ít nhất 2 thành viên ngoài bản thân.',
      );
      return;
    }
    setCreating(true);
    try {
      const convId = await createGroup({
        name: groupName.trim(),
        creatorUid: uid,
        creatorName: ownName,
        memberUids: selected,
      });
      navigation.replace('ChatDetail', {
        convId,
        name: groupName.trim(),
        isGroup: true,
      });
    } catch (e) {
      Alert.alert('Không tạo được nhóm', errorMessage(e));
      setCreating(false);
    }
  }

  const canCreate = Boolean(groupName.trim()) && selected.length >= 2 && !creating;

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.root}>
      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.heading}>Tạo nhóm mới</Text>
        <Pressable
          accessibilityRole="button"
          disabled={!canCreate}
          onPress={handleCreate}
          style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.createBtnText}>Tạo</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Tên nhóm</Text>
        <TextInput
          style={styles.nameInput}
          placeholder="Ví dụ: Nhóm đồ án, Gia đình…"
          placeholderTextColor={colors.textMuted}
          value={groupName}
          onChangeText={setGroupName}
          maxLength={60}
        />
        <Text style={styles.hint}>
          Đã chọn {selected.length} thành viên (tối thiểu 2 người ngoài bản thân)
        </Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm thành viên trong danh bạ…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={contacts}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Không có thành viên phù hợp</Text>
          </View>
        }
        renderItem={({ item }) => {
          const checked = selected.includes(item.uid);
          return (
            <Pressable
              style={[styles.row, checked && styles.rowSelected]}
              onPress={() => toggleMember(item.uid)}
            >
              <Avatar
                name={item.name}
                avatarUrl={item.avatarUrl}
                size={48}
                online={item.online}
              />
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.status}>
                  {item.online ? 'Đang hoạt động' : 'Không hoạt động'}
                </Text>
              </View>
              <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                {checked && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { flex: 1, fontSize: 19, fontWeight: '800', color: colors.text },
  createBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    minWidth: 68,
    alignItems: 'center',
  },
  createBtnDisabled: { backgroundColor: colors.surfaceAlt },
  createBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  formSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  nameInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  searchBar: {
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 44,
    gap: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  list: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.softBlue,
    borderColor: colors.primary,
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  status: { fontSize: 12, color: colors.textMuted },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  empty: { padding: 36, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 14 },
});
