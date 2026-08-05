import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, FONTS } from '@/src/theme';
import { useAuth } from '@/src/auth';

export default function Welcome() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'admin') router.replace('/admin');
      else router.replace('/(tabs)/home');
    }
  }, [user, loading, router]);

  return (
    <View style={styles.root} testID="welcome-screen">
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1513346940221-6f673d962e97?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200' }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(15,15,15,0.55)', 'rgba(15,15,15,0.85)', COLORS.surface]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <View style={styles.ornament} />
          <Text style={styles.title} testID="welcome-title">KWE AHOSSUM{"\n"}NAKÓ EZIN</Text>
          <View style={styles.divider} />
          <Text style={styles.subtitle}>Agendamento de Consultas Espirituais</Text>
          <Text style={styles.owner}>Eliton d&apos;Ajauncy</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            testID="welcome-login-button"
            onPress={() => router.push('/login')}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryBtnText}>Entrar</Text>
          </Pressable>
          <Pressable
            testID="welcome-register-button"
            onPress={() => router.push('/register')}
            style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ghostBtnText}>Criar conta</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  safe: { flex: 1, paddingHorizontal: SPACING.xl, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.lg },
  ornament: {
    width: 90, height: 1, backgroundColor: COLORS.brand, opacity: 0.9,
    shadowColor: COLORS.brand, shadowOpacity: 0.6, shadowRadius: 8,
  },
  title: {
    color: COLORS.onSurface,
    fontFamily: FONTS.displayBold,
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
    letterSpacing: 2,
  },
  divider: { width: 60, height: 1, backgroundColor: COLORS.brand, marginTop: SPACING.xs },
  subtitle: {
    color: COLORS.onSurfaceSecondary, fontSize: 15, letterSpacing: 1.5,
    textAlign: 'center', textTransform: 'uppercase',
  },
  owner: {
    color: COLORS.brand, fontFamily: FONTS.displayRegular, fontSize: 18,
    fontStyle: 'italic', marginTop: SPACING.xs,
  },
  actions: { gap: SPACING.md, paddingBottom: SPACING.lg },
  primaryBtn: {
    backgroundColor: COLORS.brand,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: COLORS.onBrandPrimary, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  ghostBtn: {
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.brand,
    alignItems: 'center',
  },
  ghostBtnText: { color: COLORS.brand, fontSize: 16, fontWeight: '600', letterSpacing: 1 },
});
