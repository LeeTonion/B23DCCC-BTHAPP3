import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { Avatar } from './Avatar';
import type { Conversation, Profile } from '../services/chat';
import {
  addGroupMembers,
  leaveGroup,
  removeGroupMember,
  renameGroup,
} from '../services/groupService';
import { errorMessage } from '../services/firebase';
import { colors } from '../theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onLeftGroup: () => void;
  convId: string;
  conversation: Conversation;
  uid: string;
  ownName: string;
  users: Record<string, Profile>;
  presence: Record<string, Record<string, boolean>>;
}

export function GroupInfoModal({
  visible,
  onClose,
  onLeftGroup,
  convId,
  conversation,
  uid,
  ownName,
  users,
  presence,
}: Props) {
  const memberUids = Object.keys(conversation.members || {});
  const [nameDraft, setNameDraft] = useState(conversation.name || '');
  const [addingMode, setAddingMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const nonMembers = Object.entries(users).filter(
    ([id]) => !conversation.members?.[id],
  );

  async function handleRename() {
    if (!nameDraft.trim() || busy) {
      return;
    }
    setBusy(true);
    try {
      await renameGroup({
        convId,
        newName: nameDraft.trim(),
        actorUid: uid,
        actorName: ownName,
        memberUids,
      });
      Alert.alert('Thành công', 'Đã đổi tên nhóm.');
    } catch (e) {
      Alert.alert('Lỗi', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMember(targetUid: string, targetName: string) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await addGroupMembers({
        convId,
        groupName: conversation.name || 'Nhóm chat',
        newMembers: [{ uid: targetUid, name: targetName }],
        actorUid: uid,
        actorName: ownName,
        existingMemberUids: memberUids,
      });
      setAddingMode(false);
    } catch (e) {
      Alert.alert('Lỗi', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(targetUid: string, targetName: string) {
    Alert.alert('Xóa thành viên', `Xóa ${targetName} khỏi nhóm?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeGroupMember({
              convId,
              targetUid,
              targetName,
              actorUid: uid,
              actorName: ownName,
              remainingMemberUids: memberUids.filter(id => id !== targetUid),
            });
          } catch (e) {
            Alert.alert('Lỗi', errorMessage(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function confirmLeave() {
    Alert.alert('Rời nhóm', 'Bạn có chắc muốn rời khỏi nhóm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Rời nhóm',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await leaveGroup({
              convId,
              uid,
              userName: ownName,
              remainingMemberUids: memberUids.filter(id => id !== uid),
            });
            onClose();
            onLeftGroup();
          } catch (e) {
            Alert.alert('Lỗi', errorMessage(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Thông tin nhóm</Text>
          {busy ? <ActivityIndicator color={colors.primary} /> : <View style={styles.iconBtn} />}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>Tên nhóm</Text>
          <View style={styles.renameRow}>
            <TextInput
              style={styles.input}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Tên nhóm"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={styles.saveBtn} onPress={handleRename} disabled={busy}>
              <Text style={styles.saveBtnText}>Lưu</Text>
            </Pressable>
          </View>

          <View style={styles.membersHeader}>
            <Text style={styles.sectionLabel}>
              Thành viên ({memberUids.length})
            </Text>
            <Pressable
              style={styles.addBtn}
              onPress={() => setAddingMode(v => !v)}
            >
              <Ionicons name="person-add-outline" size={16} color={colors.primary} />
              <Text style={styles.addBtnText}>
                {addingMode ? 'Đóng' : 'Thêm'}
              </Text>
            </Pressable>
          </View>

          {addingMode && (
            <View style={styles.addBox}>
              <Text style={styles.addBoxTitle}>Chọn người để thêm:</Text>
              {nonMembers.length === 0 ? (
                <Text style={styles.emptyText}>
                  Tất cả người dùng đều đã ở trong nhóm.
                </Text>
              ) : (
                nonMembers.map(([id, p]) => (
                  <Pressable
                    key={id}
                    style={styles.memberRow}
                    onPress={() => handleAddMember(id, p.name)}
                  >
                    <Avatar name={p.name} avatarUrl={p.avatarUrl} size={40} />
                    <Text style={styles.memberName}>{p.name}</Text>
                    <Ionicons
                      name="add-circle-outline"
                      size={22}
                      color={colors.primary}
                    />
                  </Pressable>
                ))
              )}
            </View>
          )}

          {memberUids.map(id => {
            const p = users[id];
            const online = Object.values(presence[id] || {}).some(Boolean);
            const isCreator = conversation.createdBy === id;
            return (
              <View key={id} style={styles.memberRow}>
                <Avatar
                  name={p?.name || 'Thành viên'}
                  avatarUrl={p?.avatarUrl}
                  size={44}
                  online={online}
                />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {id === uid ? `${p?.name || 'Bạn'} (Bạn)` : p?.name || 'Thành viên'}
                  </Text>
                  {isCreator && (
                    <Text style={styles.roleText}>Quản trị viên</Text>
                  )}
                </View>
                {id !== uid && (
                  <Pressable
                    hitSlop={8}
                    onPress={() => confirmRemove(id, p?.name || 'thành viên này')}
                  >
                    <Ionicons
                      name="remove-circle-outline"
                      size={22}
                      color={colors.danger}
                    />
                  </Pressable>
                )}
              </View>
            );
          })}

          <Pressable style={styles.leaveBtn} onPress={confirmLeave} disabled={busy}>
            <Ionicons name="exit-outline" size={20} color={colors.danger} />
            <Text style={styles.leaveText}>Rời nhóm</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  renameRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700' },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.softBlue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  addBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  addBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addBoxTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 13, color: colors.textMuted },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberInfo: { flex: 1 },
  memberName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  roleText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: '#FFF0EE',
    borderWidth: 1,
    borderColor: '#F5C2BC',
    paddingVertical: 14,
    borderRadius: 16,
  },
  leaveText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
