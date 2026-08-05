import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '@/src/theme';
import { useAuth } from '@/src/auth';
import { WEEKDAY_LABEL } from '@/src/support';

type Event = {
  id: string; title: string; description?: string;
  date?: string | null; time?: string | null;
  recurrence?: string | null; month?: string | null;
  category?: string;
};

export default function CasaScreen() {
  const { authFetch } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [gira, setGira] = useState<{ weekday: number; time: string; note?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [evRes, setRes] = await Promise.all([
        authFetch('/events'),
        authFetch('/settings'),
      ]);
      const evData = evRes.ok ? await evRes.json() : [];
      const setData = setRes.ok ? await setRes.json() : null;
      setEvents(Array.isArray(evData) ? evData : []);
      setGira(setData?.gira || null);
    } catch {}
    setLoading(false); setRefreshing(false);
  }, [authFetch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brand} />}
      >
        <View>
          <Text style={styles.h1}>A Casa</Text>
          <View style={styles.divider} />
          <Text style={styles.subtitle}>Giras, eventos e programação da casa</Text>
        </View>

        {/* Giras */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons name="flame" size={18} color={COLORS.brand} />
            <Text style={styles.sectionTitle}>Giras</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={COLORS.brand} />
          ) : gira ? (
            <View style={styles.giraCard} testID="gira-card">
              <Text style={styles.giraWhen}>
                {WEEKDAY_LABEL[gira.weekday] || 'Quarta-feira'} · {gira.time}
              </Text>
              <Text style={styles.giraDesc}>
                As Giras da Casa acontecem semanalmente, sempre às {gira.time}.
              </Text>
              {gira.note ? (
                <View style={styles.noteRow}>
                  <Ionicons name="information-circle-outline" size={14} color={COLORS.onWarning} />
                  <Text style={styles.noteText}>{gira.note}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.empty}>Nenhuma gira configurada.</Text>
          )}
        </View>

        {/* Eventos */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons name="calendar" size={18} color={COLORS.brand} />
            <Text style={styles.sectionTitle}>Agenda Anual de Eventos</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={COLORS.brand} />
          ) : events.length === 0 ? (
            <Text style={styles.empty}>Nenhum evento cadastrado.</Text>
          ) : (
            <View style={{ gap: SPACING.md }}>
              {events.map(ev => (
                <View key={ev.id} style={styles.eventCard} testID={`event-${ev.id}`}>
                  {ev.month ? (
                    <Text style={styles.eventMonth}>{ev.month.toUpperCase()}</Text>
                  ) : null}
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  <View style={styles.eventMeta}>
                    <Ionicons name={ev.recurrence ? 'repeat-outline' : 'calendar-outline'} size={13} color={COLORS.brand} />
                    <Text style={styles.eventMetaText}>
                      {ev.recurrence
                        ? ev.recurrence
                        : ev.date
                          ? `${fmtDate(ev.date)}${ev.time ? ` às ${ev.time}` : ''}`
                          : 'A definir'}
                    </Text>
                  </View>
                  {ev.description ? <Text style={styles.eventDesc}>{ev.description}</Text> : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxxl, gap: SPACING.lg },
  h1: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 28 },
  divider: { width: 40, height: 1, backgroundColor: COLORS.brand, marginTop: 4 },
  subtitle: { color: COLORS.onSurfaceTertiary, fontSize: 13, marginTop: SPACING.xs },
  section: { gap: SPACING.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionTitle: { color: COLORS.brand, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  giraCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.brand,
    gap: SPACING.sm,
  },
  giraWhen: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 22 },
  giraDesc: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  noteRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: COLORS.warning, padding: SPACING.sm, borderRadius: RADIUS.sm,
  },
  noteText: { color: COLORS.onWarning, fontSize: 12, flex: 1 },
  eventCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  eventMonth: { color: COLORS.brand, fontSize: 10, letterSpacing: 2 },
  eventTitle: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 20 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 4 },
  eventMetaText: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  eventDesc: { color: COLORS.onSurfaceTertiary, fontSize: 13, marginTop: SPACING.xs, lineHeight: 18 },
  empty: { color: COLORS.muted, fontSize: 13, textAlign: 'center', paddingVertical: SPACING.lg },
});
