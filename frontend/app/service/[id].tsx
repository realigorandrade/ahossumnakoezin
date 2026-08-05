import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, ImageBackground, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, formatBRL, modalityLabel } from '@/src/theme';
import { useAuth } from '@/src/auth';

type Service = {
  id: string; name: string; description: string; price: number;
  duration_minutes?: number;
  modalities: string[]; image: string; observations: string[];
};

export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { authFetch } = useAuth();

  const [svc, setSvc] = useState<Service | null>(null);
  const [modality, setModality] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ id: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const r = await authFetch(`/services/${id}`);
      if (r.ok) {
        const d = await r.json();
        setSvc(d);
        if (d.modalities.length === 1) setModality(d.modalities[0]);
      }
    })();
  }, [id, authFetch]);

  const days = useMemo(() => {
    const arr: { iso: string; label: string; day: string; wd: string }[] = [];
    const wds = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      arr.push({ iso, label: `${d.getDate()}`, day: String(d.getMonth() + 1).padStart(2, '0'), wd: wds[d.getDay()] });
    }
    return arr;
  }, []);

  const loadSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    setSelectedTime('');
    try {
      const r = await authFetch(`/slots?date=${date}`);
      const d = await r.json();
      setSlots(d.slots || []);
    } catch { setSlots([]); }
    setLoadingSlots(false);
  }, [authFetch]);

  useEffect(() => {
    if (selectedDate) loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const canSubmit = svc && modality && selectedDate && selectedTime && terms && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError('');
    try {
      const r = await authFetch('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          service_id: svc!.id,
          date: selectedDate,
          time: selectedTime,
          modality,
          terms_accepted: true,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Falha ao agendar');
      // Navigate to payment/comprovante screen
      router.replace(`/payment/${data.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!svc) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.brand} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <ImageBackground source={{ uri: svc.image }} style={styles.hero}>
          <LinearGradient colors={['rgba(15,15,15,0.2)', 'rgba(15,15,15,0.95)']} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={['top']} style={{ flex: 1, padding: SPACING.lg, justifyContent: 'space-between' }}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} testID="service-back">
              <Ionicons name="chevron-back" size={22} color={COLORS.brand} />
            </Pressable>
            <View>
              <View style={styles.priceBadge}>
                <Text style={styles.priceText}>{formatBRL(svc.price)}</Text>
              </View>
              <Text style={styles.heroTitle}>{svc.name}</Text>
              <Text style={styles.heroDesc}>{svc.description}</Text>
              {svc.duration_minutes ? (
                <View style={styles.durationBadge}>
                  <Ionicons name="time-outline" size={13} color={COLORS.brand} />
                  <Text style={styles.durationBadgeText}>Duração estimada: {svc.duration_minutes} min</Text>
                </View>
              ) : null}
            </View>
          </SafeAreaView>
        </ImageBackground>

        <View style={styles.body}>
          <Section title="Modalidade">
            <View style={styles.rowWrap}>
              {svc.modalities.map(m => {
                const active = modality === m;
                return (
                  <Pressable
                    key={m}
                    testID={`modality-${m}`}
                    onPress={() => setModality(m)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Ionicons name={m === 'online' ? 'videocam-outline' : 'location-outline'} size={16} color={active ? COLORS.onBrandPrimary : COLORS.brand} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{modalityLabel(m)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Section title="Data">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm, paddingRight: SPACING.lg }}>
              {days.map(d => {
                const active = selectedDate === d.iso;
                return (
                  <Pressable
                    key={d.iso}
                    testID={`day-${d.iso}`}
                    onPress={() => setSelectedDate(d.iso)}
                    style={[styles.dayCard, active && styles.dayCardActive]}
                  >
                    <Text style={[styles.dayWd, active && { color: COLORS.onBrandPrimary }]}>{d.wd}</Text>
                    <Text style={[styles.dayNum, active && { color: COLORS.onBrandPrimary }]}>{d.label}</Text>
                    <Text style={[styles.dayMon, active && { color: COLORS.onBrandPrimary }]}>{d.day}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>

          <Section title="Horário">
            {!selectedDate ? (
              <Text style={styles.muted}>Selecione uma data primeiro</Text>
            ) : loadingSlots ? (
              <ActivityIndicator color={COLORS.brand} />
            ) : slots.length === 0 ? (
              <Text style={styles.muted}>Nenhum horário disponível nesta data</Text>
            ) : (
              <View style={styles.timeGrid}>
                {slots.map(t => {
                  const active = selectedTime === t;
                  return (
                    <Pressable
                      key={t}
                      testID={`time-${t}`}
                      onPress={() => setSelectedTime(t)}
                      style={[styles.timeChip, active && styles.timeChipActive]}
                    >
                      <Text style={[styles.timeText, active && { color: COLORS.onBrandPrimary }]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Section>

          <Section title="Observações importantes">
            <View style={{ gap: SPACING.sm }}>
              {svc.observations.map((o, i) => (
                <View key={i} style={styles.obsRow}>
                  <View style={styles.obsDot} />
                  <Text style={styles.obsText}>{o}</Text>
                </View>
              ))}
              <Pressable
                testID="terms-checkbox"
                onPress={() => setTerms(!terms)}
                style={styles.termsRow}
              >
                <View style={[styles.checkbox, terms && styles.checkboxActive]}>
                  {terms && <Ionicons name="checkmark" size={16} color={COLORS.onBrandPrimary} />}
                </View>
                <Text style={styles.termsText}>Li e concordo com as observações.</Text>
              </Pressable>
            </View>
          </Section>

          {error ? <Text style={styles.error} testID="service-error">{error}</Text> : null}
        </View>
      </ScrollView>

      <View style={styles.stickyBar}>
        <View>
          <Text style={styles.stickyLabel}>Valor</Text>
          <Text style={styles.stickyPrice}>{formatBRL(svc.price)}</Text>
        </View>
        <Pressable
          testID="submit-booking"
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.cta, !canSubmit && { opacity: 0.4 }]}
        >
          {submitting ? <ActivityIndicator color={COLORS.onBrandPrimary} /> : (
            <>
              <Text style={styles.ctaText}>Agendar</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.onBrandPrimary} />
            </>
          )}
        </Pressable>
      </View>

      <Modal visible={!!success} transparent animationType="fade" onRequestClose={() => setSuccess(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard} testID="booking-success">
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={36} color={COLORS.onBrandPrimary} />
            </View>
            <Text style={styles.modalTitle}>Agendamento realizado</Text>
            <Text style={styles.modalDesc}>
              Seu atendimento foi registrado com status{'\n'}
              <Text style={{ color: COLORS.onWarning, fontWeight: '700' }}>Aguardando pagamento</Text>.{'\n\n'}
              Realize o pagamento via PIX para a chave enviada pela casa espiritual. Após a confirmação, você receberá as instruções.
            </Text>
            <Pressable
              testID="success-appointments"
              onPress={() => { setSuccess(null); router.replace('/(tabs)/appointments'); }}
              style={styles.modalBtn}
            >
              <Text style={styles.modalBtnText}>Ver meus agendamentos</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: SPACING.md, marginBottom: SPACING.lg }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  hero: { height: 320, justifyContent: 'flex-end' },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(15,15,15,0.7)',
    borderWidth: 1, borderColor: COLORS.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  priceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brand,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderRadius: RADIUS.pill,
    marginBottom: SPACING.sm,
  },
  priceText: { color: COLORS.onBrandPrimary, fontWeight: '700', fontSize: 13 },
  heroTitle: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 28, marginBottom: SPACING.xs },
  heroDesc: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18 },
  durationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    marginTop: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 5,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.brand,
    backgroundColor: 'rgba(15,15,15,0.55)',
  },
  durationBadgeText: { color: COLORS.brand, fontSize: 12, fontWeight: '600' },
  body: { padding: SPACING.lg },
  sectionTitle: {
    color: COLORS.brand, fontSize: 12, letterSpacing: 2,
    textTransform: 'uppercase',
  },
  rowWrap: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingHorizontal: SPACING.lg, paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.brand,
  },
  chipActive: { backgroundColor: COLORS.brand },
  chipText: { color: COLORS.brand, fontWeight: '600' },
  chipTextActive: { color: COLORS.onBrandPrimary },
  dayCard: {
    width: 62, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center', gap: 2,
  },
  dayCardActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  dayWd: { color: COLORS.muted, fontSize: 10, letterSpacing: 1 },
  dayNum: { color: COLORS.onSurface, fontSize: 20, fontFamily: FONTS.displayBold },
  dayMon: { color: COLORS.muted, fontSize: 10 },
  muted: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  timeChip: {
    paddingHorizontal: SPACING.lg, paddingVertical: 10,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    minWidth: 84, alignItems: 'center',
  },
  timeChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  timeText: { color: COLORS.onSurface, fontWeight: '600' },
  obsRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
  obsDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.brand, marginTop: 8 },
  obsText: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
  termsRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginTop: SPACING.md, padding: SPACING.md,
    borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1, borderColor: COLORS.border,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 1.5, borderColor: COLORS.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.brand },
  termsText: { color: COLORS.onSurface, fontSize: 14, flex: 1 },
  error: { color: COLORS.onError, backgroundColor: COLORS.error, padding: SPACING.md, borderRadius: RADIUS.sm },
  stickyBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.surfaceSecondary,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    padding: SPACING.lg, paddingBottom: SPACING.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  stickyLabel: { color: COLORS.muted, fontSize: 11, letterSpacing: 1 },
  stickyPrice: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 22 },
  cta: {
    backgroundColor: COLORS.brand, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
  },
  ctaText: { color: COLORS.onBrandPrimary, fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  modalCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg, padding: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.brand,
    alignItems: 'center', gap: SPACING.md, maxWidth: 380,
  },
  successIcon: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 22, textAlign: 'center' },
  modalDesc: { color: COLORS.onSurfaceSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  modalBtn: {
    backgroundColor: COLORS.brand, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, marginTop: SPACING.md,
  },
  modalBtnText: { color: COLORS.onBrandPrimary, fontWeight: '700', letterSpacing: 0.5 },
});
