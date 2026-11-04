import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { AppButton } from '../components/AppButton';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useChatData } from '../context/ChatContext';
import { errorMessage } from '../services/firebase';
import { colors } from '../theme/colors';

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { users } = useChatData();
  const [busy, setBusy] = useState(false);

  const displayName = users[user!.uid]?.name || user?.displayName || 'Người dùng';

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

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <Text style={styles.screenHeading}>CÀI ĐẶT</Text>

      <View style={styles.profileCard}>
        <Avatar name={displayName} size={76} online={true} />
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.row}>
          <View style={styles.iconCircle}>
            <Ionicons name="notifications-outline" size={20} color="#00F0FF" />
          </View>
          <Text style={styles.rowLabel}>Thông báo</Text>
          <Text style={styles.rowValue}>Bật</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#00FF9D" />
          </View>
          <Text style={styles.rowLabel}>Bảo mật</Text>
          <Text style={[styles.rowValue, { color: '#00FF9D' }]}>Đã mã hoá</Text>
        </View>
      </View>

      <View style={styles.logoutSection}>
        <AppButton
          title={busy ? 'ĐANG ĐĂNG XUẤT…' : 'ĐĂNG XUẤT'}
          variant="danger"
          onPress={submit}
        />
      </View>
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
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 14,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#94A3B8',
  },
  sectionCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#1E293B',
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
    backgroundColor: '#0F1A2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  rowValue: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
  },
  logoutSection: {
    marginTop: 'auto',
    marginBottom: 24,
  },
});
