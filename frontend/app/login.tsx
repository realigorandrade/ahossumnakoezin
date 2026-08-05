import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '@/src/theme';
import { useAuth } from '@/src/auth';
import Logo from '@/src/Logo';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!email || !password) { setError('Preencha e-mail e senha'); return; }
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      if (u.role === 'admin') router.replace('/admin');
      else router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back} testID="login-back">
            <Ionicons name="chevron-back" size={22} color={COLORS.brand} />
          </Pressable>
          <View style={styles.header}>
            <Logo size={68} />
            <Text style={styles.title}>Bem-vindo(a)</Text>
            <Text style={styles.subtitle}>Entre para agendar sua consulta</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              testID="login-email"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={COLORS.onSurfaceTertiary}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.pwWrap}>
              <TextInput
                testID="login-password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.onSurfaceTertiary}
                style={[styles.input, { flex: 1, borderBottomWidth: 0 }]}
                secureTextEntry={!showPw}
              />
              <Pressable onPress={() => setShowPw(!showPw)} hitSlop={10}>
                <Ionicons name={showPw ? 'eye-off' : 'eye'} size={20} color={COLORS.muted} />
              </Pressable>
            </View>
          </View>

          {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

          <Pressable
            testID="login-submit"
            onPress={submit}
            disabled={loading}
            style={({ pressed }) => [styles.primaryBtn, (pressed || loading) && { opacity: 0.85 }]}
          >
            {loading ? <ActivityIndicator color={COLORS.onBrandPrimary} /> : <Text style={styles.primaryBtnText}>Entrar</Text>}
          </Pressable>

          <Pressable onPress={() => router.push('/register')} style={styles.linkRow} testID="login-goto-register">
            <Text style={styles.linkMuted}>Ainda não tem conta?</Text>
            <Text style={styles.link}> Criar conta</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.xl, paddingTop: SPACING.md, gap: SPACING.lg },
  back: { alignSelf: 'flex-start', padding: SPACING.xs },
  header: { alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  title: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 28, marginTop: SPACING.sm },
  subtitle: { color: COLORS.onSurfaceTertiary, fontSize: 13, letterSpacing: 1 },
  field: { gap: SPACING.xs },
  label: { color: COLORS.brand, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
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
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.md },
  linkMuted: { color: COLORS.onSurfaceTertiary },
  link: { color: COLORS.brand, fontWeight: '600' },
});
