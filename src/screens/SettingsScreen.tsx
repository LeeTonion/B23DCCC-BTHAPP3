import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { AppButton } from '../components/AppButton';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useChatData } from '../context/ChatContext';
import { updateUserProfile } from '../services/auth';
import { errorMessage } from '../services/firebase';
import {
  pickImageFromCamera,
  pickImageFromLibrary,
  uploadImageToCloudinary,
} from '../services/uploadService';
import { colors } from '../theme/colors';

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { users } = useChatData();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const uid = user!.uid;
  const profile = users[uid];
  const displayName = profile?.name || user?.displayName || 'Người dùng';
  const avatarUrl = profile?.avatarUrl || user?.photoURL || undefined;

  async function submit() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await logout();
    } catch (e) {
      Alert.alert('Đăng xuất', errorMessage(e));
      setBusy(false);
    }
  }

  function openEdit() {
    setNameDraft(displayName);
    setEditing(true);
  }

  async function saveName() {
    if (!nameDraft.trim() || savingProfile) {
      return;
    }
    setSavingProfile(true);
    try {
      await updateUserProfile(uid, { name: nameDraft.trim() });
      setEditing(false);
    } catch (e) {
      Alert.alert('Cập nhật hồ sơ', errorMessage(e));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changeAvatar(source: 'camera' | 'library') {
    if (savingProfile) {
      return;
    }
    try {
      const picked =
        source === 'camera'
          ? await pickImageFromCamera()
          : await pickImageFromLibrary();
      if (!picked) {
        return;
      }
      setSavingProfile(true);
      const url = await uploadImageToCloudinary(
        picked.uri,
        picked.fileName,
        picked.type,
      );
      await updateUserProfile(uid, { avatarUrl: url });
    } catch (e) {
      Alert.alert('Đổi ảnh đại diện', errorMessage(e));
    } finally {
      setSavingProfile(false);
    }
  }

  function promptAvatar() {
    Alert.alert('Ảnh đại diện', 'Chọn nguồn ảnh', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Chụp ảnh', onPress: () => changeAvatar('camera') },
      { text: 'Chọn từ thư viện', onPress: () => changeAvatar('library') },
    ]);
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <Text style={styles.screenHeading}>Cài đặt</Text>

      <View style={styles.profileCard}>
        <Pressable onPress={promptAvatar} style={styles.avatarWrap}>
          <Avatar
            name={displayName}
            avatarUrl={avatarUrl}
            size={84}
            online={true}
          />
          <View style={styles.cameraBadge}>
            {savingProfile ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            )}
          </View>
        </Pressable>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Pressable style={styles.editBtn} onPress={openEdit}>
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={styles.editBtnText}>Chỉnh sửa hồ sơ</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.row}>
          <View style={styles.iconCircle}>
            <Ionicons
              name="notifications-outline"
              size={20}
              color={colors.primary}
            />
          </View>
          <Text style={styles.rowLabel}>Thông báo</Text>
          <Text style={styles.rowValue}>Bật</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.iconCircle}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={colors.success}
            />
          </View>
          <Text style={styles.rowLabel}>Bảo mật</Text>
          <Text style={[styles.rowValue, { color: colors.success }]}>
            Đã mã hoá
          </Text>
        </View>
      </View>

      <View style={styles.logoutSection}>
        <AppButton
          title={busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
          variant="danger"
          onPress={submit}
        />
      </View>

      <Modal
        visible={editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Đổi họ tên</Text>
            <TextInput
              style={styles.modalInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Nhập họ tên mới"
              placeholderTextColor={colors.textMuted}
              maxLength={60}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setEditing(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={styles.modalSave}
                disabled={savingProfile || !nameDraft.trim()}
                onPress={saveName}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Lưu</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
  },
  screenHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginTop: 14,
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
  },
  avatarWrap: { position: 'relative' },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 14,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.textMuted,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    backgroundColor: colors.softBlue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowValue: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  logoutSection: {
    marginTop: 'auto',
    marginBottom: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalCancelText: { fontWeight: '600', color: colors.textMuted },
  modalSave: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 72,
    alignItems: 'center',
  },
  modalSaveText: { fontWeight: '700', color: '#FFFFFF' },
});
