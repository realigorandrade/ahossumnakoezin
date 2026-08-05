import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, formatBRL, statusInfo, modalityLabel } from '@/src/theme';
import { useAuth } from '@/src/auth';

type Booking = {
  id: string; service_name: string; date: string; time: string;
  modality: string; price: number; status: string;
};

export default function Appointments() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await authFetch('/bookings/me');
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [authFetch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancel = async (id: string) => {
    await authFetch(`/bookings/${id}`, { method: 'DELETE' });
    load();
  };

  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Meus Agendamentos</Text>
        <View style={styles.divider} />
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.brand} style={{ marginTop: SPACING.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brand} />}
        >
          {items.length === 0 ? (
            <View style={styles.empty} testID="appointments-empty">
              <Ionicons name="calendar-outline" size={48} color={COLORS.brand} />
              <Text style={styles.emptyTitle}>Nenhum agendamento</Text>
              <Text style={styles.emptyDesc}>Suas consultas aparecerão aqui</Text>
            </View>
          ) : items.map(b => {
            const s = statusInfo(b.status);
            const canCancel = b.status !== 'cancelado' && b.status !== 'concluido';
            return (
              <View key={b.id} style={styles.card} testID={`booking-${b.id}`}>
                <View style={styles.cardHeader}>
                  <Text style={styles.svcName}>{b.service_name}</Text>
                  <View style={[styles.badge, { backgroundColor: s.bg }]}>
                    <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
                  </View>
                </View>
                <View style={styles.row}>
                  <Ionicons name="calendar-outline" size={16} color={COLORS.brand} />
                  <Text style={styles.rowText}>{fmtDate(b.date)} · {b.time}</Text>
                </View>
                <View style={styles.row}>
                  <Ionicons name="location-outline" size={16} color={COLORS.brand} />
                  <Text style={styles.rowText}>{modalityLabel(b.modality)}</Text>
                </View>
                <View style={styles.row}>
                  <Ionicons name="cash-outline" size={16} color={COLORS.brand} />
                  <Text style={styles.rowText}>{formatBRL(b.price)}</Text>
                </View>
                {canCancel && (
                  <View style={{ flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', marginTop: SPACING.sm }}>
                    {b.status === 'aguardando_pagamento' && (
                      <Pressable
                        testID={`pay-${b.id}`}
                        onPress={() => router.push(`/payment/${b.id}`)}
                        style={styles.payBtn}
                      >
                        <Ionicons name="qr-code-outline" size={16} color={COLORS.onBrandPrimary} />
                        <Text style={styles.payText}>Ver PIX / Enviar comprovante</Text>
                      </Pressable>
                    )}
                    <Pressable
                      testID={`cancel-${b.id}`}
                      onPress={() => cancel(b.id)}
                      style={styles.cancelBtn}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={COLORS.onError} />
                      <Text style={styles.cancelText}>Cancelar</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { padding: SPACING.lg, gap: SPACING.xs },
  h1: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 28 },
  divider: { width: 40, height: 1, backgroundColor: COLORS.brand },
  scroll: { padding: SPACING.lg, paddingTop: 0, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  empty: { alignItems: 'center', gap: SPACING.md, marginTop: SPACING.xxxl },
  emptyTitle: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 20 },
  emptyDesc: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.sm },
  svcName: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 18, flex: 1 },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  rowText: { color: COLORS.onSurfaceSecondary, fontSize: 14 },
  cancelBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderRadius: RADIUS.pill, backgroundColor: COLORS.error,
  },
  cancelText: { color: COLORS.onError, fontSize: 12, fontWeight: '600' },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderRadius: RADIUS.pill, backgroundColor: COLORS.brand,
  },
  payText: { color: COLORS.onBrandPrimary, fontSize: 12, fontWeight: '700' },
});
