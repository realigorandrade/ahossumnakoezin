import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '@/src/theme';
import { useAuth } from '@/src/auth';
import { openWhatsApp } from '@/src/support';

const SUPPORT_WHATSAPP = '+5519988371125';

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

          <View style={styles.supportSection}>
            <Text style={styles.supportTitle}>Suporte</Text>
            <Text style={styles.supportDesc}>
              Precisa de ajuda? Fale diretamente com a casa espiritual pelo WhatsApp.
            </Text>
            <Pressable
              testID="support-whatsapp"
              onPress={() => openWhatsApp(SUPPORT_WHATSAPP, 'Olá! Preciso de suporte com o app KWE AHOSSUM NAKÓ EZIN.')}
              style={styles.whatsBtn}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#0F0F0F" />
              <Text style={styles.whatsBtnText}>Falar no WhatsApp</Text>
            </Pressable>
          </View>

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
  supportSection: {
    marginTop: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    gap: SPACING.sm,
  },
  supportTitle: { color: COLORS.brand, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  supportDesc: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18 },
  whatsBtn: {
    backgroundColor: '#25D366', paddingVertical: SPACING.md, borderRadius: RADIUS.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  whatsBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.lg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.error, marginTop: SPACING.md,
  },
  logoutText: { color: COLORS.error, fontWeight: '600', fontSize: 14, letterSpacing: 0.5 },
});
