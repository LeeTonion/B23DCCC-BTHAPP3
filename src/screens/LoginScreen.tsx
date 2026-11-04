import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { AppButton } from '../components/AppButton';
import { LabeledInput } from '../components/LabeledInput';
import { useAuth } from '../context/AuthContext';
import { errorMessage, configured } from '../services/firebase';
import type { RootStackScreenProps } from '../navigation/types';
import { colors } from '../theme/colors';

export function LoginScreen({
  navigation,
  route,
}: RootStackScreenProps<'Login'> | RootStackScreenProps<'Register'>) {
  const registering = route.name === 'Register';
  const { login, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }
    if (!email.trim() || !password || (registering && !name.trim())) {
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    if (registering && password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (registering && password !== confirm) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (registering) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="chatbubble-ellipses" size={30} color="#FFFFFF" />
          </View>
          <Text style={styles.brand}>Chat App</Text>
          <Text style={styles.title}>
            {registering ? 'Tạo tài khoản' : 'Chào mừng trở lại'}
          </Text>
          <Text style={styles.subtitle}>
            {registering
              ? 'Đăng ký nhanh để kết nối cùng mọi người'
              : 'Kết nối và trò chuyện cùng bạn bè thời gian thực.'}
          </Text>
        </View>

        <View style={styles.card}>
          {!configured && (
            <View style={styles.alertBox}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.alertText}>
                Chưa cấu hình Firebase. Xem hướng dẫn trong README.
              </Text>
            </View>
          )}

          {registering && (
            <LabeledInput
              label="Họ tên"
              placeholder="Nhập tên hiển thị của bạn"
              value={name}
              onChangeText={setName}
              autoComplete="name"
            />
          )}

          <LabeledInput
            label="Email"
            placeholder="example@gmail.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
          />

          <LabeledInput
            label="Mật khẩu"
            placeholder="Tối thiểu 6 ký tự"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={registering ? 'new-password' : 'current-password'}
          />

          {registering && (
            <LabeledInput
              label="Nhập lại mật khẩu"
              placeholder="Xác nhận mật khẩu"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
            />
          )}

          {!!error && (
            <View style={styles.alertBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text accessibilityRole="alert" style={styles.alertText}>
                {error}
              </Text>
            </View>
          )}

          <AppButton
            title={
              busy
                ? 'Đang xử lý…'
                : registering
                ? 'Đăng ký tài khoản'
                : 'Đăng nhập'
            }
            onPress={submit}
            style={styles.submitBtn}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
          disabled={busy}
          onPress={() =>
            registering ? navigation.goBack() : navigation.navigate('Register')
          }
        >
          <Text style={styles.linkText}>
            {registering
              ? 'Đã có tài khoản? '
              : 'Chưa có tài khoản? '}
            <Text style={styles.linkHighlight}>
              {registering ? 'Đăng nhập ngay' : 'Đăng ký ngay'}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 36,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  brand: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  alertText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: 6,
  },
  link: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  linkText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  linkHighlight: {
    color: colors.primary,
    fontWeight: '700',
  },
});
