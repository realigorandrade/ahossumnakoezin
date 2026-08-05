import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '@/src/theme';
import { useAuth } from '@/src/auth';
import Logo from '@/src/Logo';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [f, setF] = useState({
    full_name: '', email: '', phone: '', birthdate: '', password: '', confirm_password: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof f, v: string) => setF(prev => ({ ...prev, [k]: v }));

  const formatBirth = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 8);
    // Convert DD/MM/YYYY typing
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const parseBirthISO = (br: string): string | null => {
    const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null;
    return `${yyyy}-${mm}-${dd}`;
  };

  const submit = async () => {
    setError('');
    if (!f.full_name || !f.email || !f.phone || !f.birthdate || !f.password || !f.confirm_password) {
      setError('Todos os campos são obrigatórios'); return;
    }
    if (f.password !== f.confirm_password) { setError('As senhas não coincidem'); return; }
    if (f.password.length < 6) { setError('Senha deve ter no mínimo 6 caracteres'); return; }
    const iso = parseBirthISO(f.birthdate);
    if (!iso) { setError('Data de nascimento inválida (DD/MM/AAAA)'); return; }
    setLoading(true);
    try {
      const u = await register({ ...f, birthdate: iso });
      if (u.role === 'admin') router.replace('/admin');
      else router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message || 'Falha no cadastro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back} testID="register-back">
            <Ionicons name="chevron-back" size={22} color={COLORS.brand} />
          </Pressable>
          <View style={styles.header}>
            <Logo size={60} />
            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>Preencha seus dados para começar</Text>
          </View>

          <Field label="Nome completo" value={f.full_name} onChange={v => set('full_name', v)} testID="register-fullname" />
          <Field label="E-mail" value={f.email} onChange={v => set('email', v)} keyboardType="email-address" autoCapitalize="none" testID="register-email" />
          <Field label="Telefone" value={f.phone} onChange={v => set('phone', v)} keyboardType="phone-pad" testID="register-phone" />
          <Field label="Data de nascimento (DD/MM/AAAA)" value={f.birthdate} onChange={v => set('birthdate', formatBirth(v))} keyboardType="number-pad" testID="register-birthdate" maxLength={10} />
          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.pwWrap}>
              <TextInput
                testID="register-password"
                value={f.password}
                onChangeText={v => set('password', v)}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={COLORS.onSurfaceTertiary}
                style={[styles.input, { flex: 1, borderBottomWidth: 0 }]}
                secureTextEntry={!showPw}
              />
              <Pressable onPress={() => setShowPw(!showPw)} hitSlop={10}>
                <Ionicons name={showPw ? 'eye-off' : 'eye'} size={20} color={COLORS.muted} />
              </Pressable>
            </View>
          </View>
          <Field label="Confirmar senha" value={f.confirm_password} onChange={v => set('confirm_password', v)} secure={!showPw} testID="register-confirm-password" />

          {error ? <Text style={styles.error} testID="register-error">{error}</Text> : null}

          <Pressable
            testID="register-submit"
            onPress={submit}
            disabled={loading}
            style={({ pressed }) => [styles.primaryBtn, (pressed || loading) && { opacity: 0.85 }]}
          >
            {loading ? <ActivityIndicator color={COLORS.onBrandPrimary} /> : <Text style={styles.primaryBtnText}>Criar conta</Text>}
          </Pressable>

          <Pressable onPress={() => router.replace('/login')} style={styles.linkRow} testID="register-goto-login">
            <Text style={styles.linkMuted}>Já possui conta?</Text>
            <Text style={styles.link}> Entrar</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, keyboardType, autoCapitalize, secure, testID, maxLength }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={COLORS.onSurfaceTertiary}
        style={styles.input}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'sentences'}
        secureTextEntry={secure}
        maxLength={maxLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.xl, paddingTop: SPACING.md, gap: SPACING.md },
  back: { alignSelf: 'flex-start', padding: SPACING.xs },
  header: { alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  title: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 26, marginTop: SPACING.sm },
  subtitle: { color: COLORS.onSurfaceTertiary, fontSize: 13, letterSpacing: 1 },
  field: { gap: SPACING.xs },
  label: { color: COLORS.brand, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  input: {
    color: COLORS.onSurface, fontSize: 16, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pwWrap: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  error: { color: COLORS.onError, backgroundColor: COLORS.error, padding: SPACING.md, borderRadius: RADIUS.sm },
  primaryBtn: {
    backgroundColor: COLORS.brand, paddingVertical: SPACING.lg, borderRadius: RADIUS.md,
    alignItems: 'center', marginTop: SPACING.md,
  },
  primaryBtnText: { color: COLORS.onBrandPrimary, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.md, marginBottom: SPACING.lg },
  linkMuted: { color: COLORS.onSurfaceTertiary },
  link: { color: COLORS.brand, fontWeight: '600' },
});
