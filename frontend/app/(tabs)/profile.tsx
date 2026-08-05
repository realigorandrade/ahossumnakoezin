import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '@/src/theme';
import { useAuth } from '@/src/auth';

export default function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const router = useRouter();
  const [full_name, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const patch: any = { full_name, email, phone };
      if (password) patch.password = password;
      await updateProfile(patch);
      setPassword('');
      setMsg({ ok: true, text: 'Perfil atualizado com sucesso' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Falha ao atualizar' });
    } finally {
      setSaving(false);
    }
  };

  const doLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.h1}>Perfil</Text>
          <View style={styles.divider} />

          <Field label="Nome completo" value={full_name} onChange={setFullName} testID="profile-name" />
          <Field label="E-mail" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" testID="profile-email" />
          <Field label="Telefone" value={phone} onChange={setPhone} keyboardType="phone-pad" testID="profile-phone" />
          <Field label="Nova senha (opcional)" value={password} onChange={setPassword} secure testID="profile-password" />

          {msg ? (
            <Text style={[styles.msg, { backgroundColor: msg.ok ? COLORS.success : COLORS.error, color: msg.ok ? COLORS.onSuccess : COLORS.onError }]}>
              {msg.text}
            </Text>
          ) : null}

          <Pressable
            testID="profile-save"
            onPress={save}
            disabled={saving}
            style={({ pressed }) => [styles.primaryBtn, (pressed || saving) && { opacity: 0.85 }]}
          >
            {saving ? <ActivityIndicator color={COLORS.onBrandPrimary} /> : <Text style={styles.primaryBtnText}>Salvar alterações</Text>}
          </Pressable>

          <Pressable testID="profile-logout" onPress={doLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
            <Text style={styles.logoutText}>Sair da conta</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, keyboardType, autoCapitalize, secure, testID }: any) {
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxxl, gap: SPACING.md },
  h1: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 28 },
  divider: { width: 40, height: 1, backgroundColor: COLORS.brand, marginBottom: SPACING.md },
  field: { gap: SPACING.xs },
  label: { color: COLORS.brand, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  input: {
    color: COLORS.onSurface, fontSize: 16, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  msg: { padding: SPACING.md, borderRadius: RADIUS.sm, fontSize: 13 },
  primaryBtn: {
    backgroundColor: COLORS.brand, paddingVertical: SPACING.lg, borderRadius: RADIUS.md,
    alignItems: 'center', marginTop: SPACING.md,
  },
  primaryBtnText: { color: COLORS.onBrandPrimary, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.lg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.error, marginTop: SPACING.md,
  },
  logoutText: { color: COLORS.error, fontWeight: '600', fontSize: 14, letterSpacing: 0.5 },
});
