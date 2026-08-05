import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, formatBRL, modalityLabel } from '@/src/theme';
import { useAuth } from '@/src/auth';
import { openWhatsApp, copyText } from '@/src/support';

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { authFetch } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [bRes, sRes] = await Promise.all([
      authFetch('/bookings/me'),
      authFetch('/settings'),
    ]);
    if (bRes.ok) {
      const list = await bRes.json();
      setBooking((list || []).find((b: any) => b.id === id) || null);
    }
    if (sRes.ok) setSettings(await sRes.json());
  }, [authFetch, id]);

  useEffect(() => { load(); }, [load]);

  const doCopy = async () => {
    if (!settings?.pix_key) return;
    const ok = await copyText(settings.pix_key);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

  const sendComprovante = () => {
    if (!settings?.support_whatsapp || !booking) return;
    const msg = `Olá! Segue o comprovante do pagamento referente ao agendamento:\n\n• Serviço: ${booking.service_name}\n• Data: ${fmtDate(booking.date)}\n• Horário: ${booking.time}\n• Modalidade: ${modalityLabel(booking.modality)}\n• Valor: ${formatBRL(booking.price)}\n• Código: ${booking.id.slice(0, 8)}`;
    openWhatsApp(settings.support_whatsapp, msg);
  };

  if (!booking || !settings) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.brand} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.replace('/(tabs)/appointments')} style={styles.close} testID="payment-close">
          <Ionicons name="close" size={22} color={COLORS.brand} />
        </Pressable>

        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={40} color={COLORS.onBrandPrimary} />
        </View>

        <Text style={styles.h1}>Agendamento realizado</Text>
        <Text style={styles.subtitle}>Finalize o pagamento via PIX para confirmar sua consulta.</Text>

        <View style={styles.bookingCard}>
          <Text style={styles.bookingSvc}>{booking.service_name}</Text>
          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.brand} />
            <Text style={styles.rowText}>{fmtDate(booking.date)} · {booking.time}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={14} color={COLORS.brand} />
            <Text style={styles.rowText}>{modalityLabel(booking.modality)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Total</Text>
            <Text style={styles.priceVal}>{formatBRL(booking.price)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Pagamento via PIX</Text>
        <View style={styles.pixCard}>
          <Text style={styles.pixLabel}>Chave PIX</Text>
          <Text style={styles.pixKey} selectable testID="pix-key">{settings.pix_key}</Text>
          {settings.pix_holder ? (
            <Text style={styles.pixHolder}>Titular: {settings.pix_holder}</Text>
          ) : null}
          <Pressable testID="copy-pix" onPress={doCopy} style={styles.copyBtn}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={COLORS.onBrandPrimary} />
            <Text style={styles.copyText}>{copied ? 'Chave copiada' : 'Copiar Chave PIX'}</Text>
          </Pressable>
        </View>

        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>Como pagar</Text>
          <Step n={1} text="Abra o app do seu banco e escolha a opção PIX." />
          <Step n={2} text={`Cole a chave copiada e informe o valor de ${formatBRL(booking.price)}.`} />
          <Step n={3} text="Finalize o pagamento e envie o comprovante pelo WhatsApp abaixo." />
          <Step n={4} text="Após a confirmação, o agendamento passa para “Confirmado”." />
        </View>

        <Pressable
          testID="send-comprovante-whatsapp"
          onPress={sendComprovante}
          style={styles.whatsBtn}
        >
          <Ionicons name="logo-whatsapp" size={20} color="#0F0F0F" />
          <Text style={styles.whatsBtnText}>Enviar comprovante via WhatsApp</Text>
        </Pressable>

        <Pressable
          testID="goto-appointments"
          onPress={() => router.replace('/(tabs)/appointments')}
          style={styles.linkBtn}
        >
          <Text style={styles.linkText}>Ver meus agendamentos</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBullet}><Text style={styles.stepBulletText}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  close: { alignSelf: 'flex-end', padding: SPACING.xs, marginBottom: SPACING.sm },
  successIcon: {
    alignSelf: 'center',
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.brand,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  h1: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 26, textAlign: 'center' },
  subtitle: { color: COLORS.onSurfaceTertiary, fontSize: 13, textAlign: 'center', marginBottom: SPACING.md },
  bookingCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  bookingSvc: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 18, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowText: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.divider, paddingTop: SPACING.sm, marginTop: SPACING.sm,
  },
  priceLabel: { color: COLORS.muted, fontSize: 12, letterSpacing: 1 },
  priceVal: { color: COLORS.brand, fontFamily: FONTS.displayBold, fontSize: 22 },
  sectionTitle: {
    color: COLORS.brand, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
    marginTop: SPACING.md,
  },
  pixCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.brand,
    gap: SPACING.sm, alignItems: 'center',
  },
  pixLabel: { color: COLORS.muted, fontSize: 11, letterSpacing: 1.2 },
  pixKey: {
    color: COLORS.onSurface, fontSize: 18, fontWeight: '700',
    textAlign: 'center', letterSpacing: 0.5, paddingHorizontal: SPACING.sm,
  },
  pixHolder: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.brand, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill, marginTop: SPACING.xs,
  },
  copyText: { color: COLORS.onBrandPrimary, fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  stepsCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  stepsTitle: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 16, marginBottom: SPACING.xs },
  stepRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  stepBullet: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBulletText: { color: COLORS.onBrandPrimary, fontSize: 11, fontWeight: '700' },
  stepText: { color: COLORS.onSurfaceSecondary, fontSize: 13, flex: 1, lineHeight: 19 },
  whatsBtn: {
    backgroundColor: '#25D366', paddingVertical: SPACING.lg, borderRadius: RADIUS.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  whatsBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
  linkBtn: { alignItems: 'center', paddingVertical: SPACING.md },
  linkText: { color: COLORS.brand, fontSize: 14, letterSpacing: 0.5 },
});
