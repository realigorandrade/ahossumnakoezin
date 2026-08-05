import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, formatBRL, statusInfo, modalityLabel } from '@/src/theme';
import { useAuth } from '@/src/auth';

type Booking = {
  id: string; user_name: string; user_email: string; user_phone: string;
  service_id: string; service_name: string; price: number;
  date: string; time: string; modality: string; status: string;
};
type Stats = { pending: number; confirmed_today: number; total_bookings: number; total_clients: number; total_revenue: number };
type Service = { id: string; name: string; price: number; observations: string[] };

const STATUS_OPTIONS = [
  { value: 'aguardando_pagamento', label: 'Aguardando' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
];

export default function Admin() {
  const { user, logout, authFetch } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'bookings' | 'clients' | 'schedule' | 'services'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [statusModalFor, setStatusModalFor] = useState<Booking | null>(null);

  const loadBookings = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (dateFilter) params.append('date', dateFilter);
    const r = await authFetch(`/admin/bookings?${params.toString()}`);
    if (r.ok) setBookings(await r.json());
  }, [authFetch, statusFilter, dateFilter]);

  const loadStats = useCallback(async () => {
    const r = await authFetch('/admin/stats');
    if (r.ok) setStats(await r.json());
  }, [authFetch]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadBookings(), loadStats()]);
    setLoading(false); setRefreshing(false);
  }, [loadBookings, loadStats]);

  useFocusEffect(useCallback(() => {
    if (!user) { router.replace('/'); return; }
    if (user.role !== 'admin') { router.replace('/(tabs)/home'); return; }
    loadAll();
  }, [user, router, loadAll]));

  useFocusEffect(useCallback(() => { loadBookings(); }, [statusFilter, dateFilter]));

  const doLogout = async () => { await logout(); router.replace('/'); };

  const changeStatus = async (bid: string, status: string) => {
    await authFetch(`/admin/bookings/${bid}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    setStatusModalFor(null);
    loadAll();
  };

  const confirmPayment = async (bid: string) => {
    await authFetch(`/admin/bookings/${bid}/confirm-payment`, { method: 'POST' });
    loadAll();
  };

  const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Painel Admin</Text>
          <Text style={styles.hSub}>{user?.full_name}</Text>
        </View>
        <Pressable onPress={doLogout} testID="admin-logout" style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        </Pressable>
      </View>

      {loading && !stats ? (
        <ActivityIndicator color={COLORS.brand} style={{ marginTop: SPACING.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor={COLORS.brand} />}
        >
          {stats && (
            <View style={styles.statsRow}>
              <StatCard label="Pendentes" value={String(stats.pending)} color={COLORS.onWarning} />
              <StatCard label="Hoje" value={String(stats.confirmed_today)} color={COLORS.onSuccess} />
              <StatCard label="Receita" value={formatBRL(stats.total_revenue)} color={COLORS.brand} />
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {[
              { k: 'bookings', label: 'Agendamentos' },
              { k: 'clients', label: 'Clientes' },
              { k: 'schedule', label: 'Horários' },
              { k: 'services', label: 'Serviços' },
            ].map(t => (
              <Pressable
                key={t.k}
                testID={`admin-tab-${t.k}`}
                onPress={() => setTab(t.k as any)}
                style={[styles.tab, tab === t.k && styles.tabActive]}
              >
                <Text style={[styles.tabText, tab === t.k && styles.tabTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {tab === 'bookings' && (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <Pressable
                  testID="filter-status-all"
                  onPress={() => setStatusFilter('')}
                  style={[styles.filterChip, !statusFilter && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, !statusFilter && styles.filterTextActive]}>Todos</Text>
                </Pressable>
                {STATUS_OPTIONS.map(s => (
                  <Pressable
                    key={s.value}
                    testID={`filter-status-${s.value}`}
                    onPress={() => setStatusFilter(s.value)}
                    style={[styles.filterChip, statusFilter === s.value && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterText, statusFilter === s.value && styles.filterTextActive]}>{s.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.dateFilterRow}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.brand} />
                <TextInput
                  testID="filter-date"
                  placeholder="Filtrar por data (YYYY-MM-DD)"
                  placeholderTextColor={COLORS.onSurfaceTertiary}
                  value={dateFilter}
                  onChangeText={setDateFilter}
                  style={styles.dateInput}
                />
                {dateFilter ? (
                  <Pressable onPress={() => setDateFilter('')}>
                    <Ionicons name="close" size={18} color={COLORS.muted} />
                  </Pressable>
                ) : null}
              </View>

              {bookings.length === 0 ? (
                <Text style={styles.empty}>Nenhum agendamento encontrado</Text>
              ) : bookings.map(b => {
                const si = statusInfo(b.status);
                return (
                  <View key={b.id} style={styles.bcard} testID={`admin-booking-${b.id}`}>
                    <View style={styles.bcardHead}>
                      <Text style={styles.bTitle}>{b.service_name}</Text>
                      <View style={[styles.badge, { backgroundColor: si.bg }]}>
                        <Text style={[styles.badgeText, { color: si.fg }]}>{si.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.bClient}>{b.user_name} · {b.user_phone}</Text>
                    <Text style={styles.bMeta}>{fmtDate(b.date)} · {b.time} · {modalityLabel(b.modality)} · {formatBRL(b.price)}</Text>
                    <View style={styles.actionsRow}>
                      {b.status === 'aguardando_pagamento' && (
                        <Pressable
                          testID={`confirm-payment-${b.id}`}
                          onPress={() => confirmPayment(b.id)}
                          style={styles.actionBtn}
                        >
                          <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.onBrandPrimary} />
                          <Text style={styles.actionText}>Confirmar pagamento</Text>
                        </Pressable>
                      )}
                      <Pressable
                        testID={`change-status-${b.id}`}
                        onPress={() => setStatusModalFor(b)}
                        style={[styles.actionBtn, styles.actionBtnGhost]}
                      >
                        <Ionicons name="options-outline" size={16} color={COLORS.brand} />
                        <Text style={[styles.actionText, { color: COLORS.brand }]}>Alterar status</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {tab === 'clients' && <ClientsTab authFetch={authFetch} />}
          {tab === 'schedule' && <ScheduleTab authFetch={authFetch} />}
          {tab === 'services' && <ServicesTab authFetch={authFetch} />}
        </ScrollView>
      )}

      <Modal visible={!!statusModalFor} transparent animationType="fade" onRequestClose={() => setStatusModalFor(null)}>
        <Pressable style={styles.modalBg} onPress={() => setStatusModalFor(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Alterar status</Text>
            {STATUS_OPTIONS.map(s => (
              <Pressable
                key={s.value}
                testID={`set-status-${s.value}`}
                onPress={() => statusModalFor && changeStatus(statusModalFor.id, s.value)}
                style={styles.modalOption}
              >
                <Text style={styles.modalOptionText}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: any) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function ClientsTab({ authFetch }: any) {
  const [clients, setClients] = useState<any[]>([]);
  useFocusEffect(useCallback(() => {
    (async () => {
      const r = await authFetch('/admin/clients');
      if (r.ok) setClients(await r.json());
    })();
  }, [authFetch]));
  const fmt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  return (
    <View style={{ gap: SPACING.md }}>
      {clients.length === 0 && <Text style={styles.empty}>Nenhum cliente cadastrado</Text>}
      {clients.map(c => (
        <View key={c.id} style={styles.bcard}>
          <Text style={styles.bTitle}>{c.full_name}</Text>
          <Text style={styles.bMeta}>{c.email}</Text>
          <Text style={styles.bMeta}>{c.phone}</Text>
          <Text style={styles.bMeta}>Nasc.: {c.birthdate ? fmt(c.birthdate) : '-'}</Text>
        </View>
      ))}
    </View>
  );
}

function ScheduleTab({ authFetch }: any) {
  const [blocked, setBlocked] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockTime, setNewBlockTime] = useState('');
  const [newHoliday, setNewHoliday] = useState({ date: '', label: '' });
  const [wh, setWH] = useState({ start: '10:00', end: '18:00', slot_minutes: 90 });

  const load = useCallback(async () => {
    const [b, h, s] = await Promise.all([
      authFetch('/admin/blocked').then((r: Response) => r.json()),
      authFetch('/admin/holidays').then((r: Response) => r.json()),
      authFetch('/settings').then((r: Response) => r.json()),
    ]);
    setBlocked(Array.isArray(b) ? b : []);
    setHolidays(Array.isArray(h) ? h : []);
    setSettings(s);
    if (s?.working_hours) setWH({
      start: s.working_hours.start, end: s.working_hours.end,
      slot_minutes: s.working_hours.slot_minutes,
    });
  }, [authFetch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addBlock = async () => {
    if (!newBlockDate) return;
    await authFetch('/admin/blocked', {
      method: 'POST',
      body: JSON.stringify({ date: newBlockDate, time: newBlockTime || null }),
    });
    setNewBlockDate(''); setNewBlockTime(''); load();
  };
  const delBlock = async (id: string) => { await authFetch(`/admin/blocked/${id}`, { method: 'DELETE' }); load(); };
  const addHol = async () => {
    if (!newHoliday.date || !newHoliday.label) return;
    await authFetch('/admin/holidays', { method: 'POST', body: JSON.stringify(newHoliday) });
    setNewHoliday({ date: '', label: '' }); load();
  };
  const delHol = async (id: string) => { await authFetch(`/admin/holidays/${id}`, { method: 'DELETE' }); load(); };
  const saveWH = async () => {
    await authFetch('/admin/working-hours', {
      method: 'PUT',
      body: JSON.stringify({ ...wh, weekdays: settings?.working_hours?.weekdays || [0, 1, 2, 3, 4, 5] }),
    });
    load();
  };

  return (
    <View style={{ gap: SPACING.lg }}>
      <View style={styles.bcard}>
        <Text style={styles.bTitle}>Horário de atendimento</Text>
        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm }}>
          <TextInput testID="wh-start" value={wh.start} onChangeText={v => setWH({ ...wh, start: v })} placeholder="10:00" placeholderTextColor={COLORS.muted} style={[styles.tinyInput, { flex: 1 }]} />
          <TextInput testID="wh-end" value={wh.end} onChangeText={v => setWH({ ...wh, end: v })} placeholder="18:00" placeholderTextColor={COLORS.muted} style={[styles.tinyInput, { flex: 1 }]} />
          <TextInput testID="wh-slot" value={String(wh.slot_minutes)} onChangeText={v => setWH({ ...wh, slot_minutes: parseInt(v || '0') || 0 })} placeholder="90" placeholderTextColor={COLORS.muted} style={[styles.tinyInput, { flex: 1 }]} keyboardType="number-pad" />
        </View>
        <Pressable testID="save-wh" onPress={saveWH} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>Salvar horários</Text>
        </Pressable>
      </View>

      <View style={styles.bcard}>
        <Text style={styles.bTitle}>Datas / horários bloqueados</Text>
        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm }}>
          <TextInput testID="block-date" value={newBlockDate} onChangeText={setNewBlockDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.muted} style={[styles.tinyInput, { flex: 1.5 }]} />
          <TextInput testID="block-time" value={newBlockTime} onChangeText={setNewBlockTime} placeholder="HH:MM (opc.)" placeholderTextColor={COLORS.muted} style={[styles.tinyInput, { flex: 1 }]} />
        </View>
        <Pressable testID="add-block" onPress={addBlock} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>Bloquear</Text>
        </Pressable>
        {blocked.map(b => (
          <View key={b.id} style={styles.listRow}>
            <Text style={styles.listText}>{b.date}{b.time ? ` · ${b.time}` : ' (dia inteiro)'}</Text>
            <Pressable onPress={() => delBlock(b.id)} testID={`del-block-${b.id}`}>
              <Ionicons name="trash-outline" size={16} color={COLORS.error} />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.bcard}>
        <Text style={styles.bTitle}>Feriados</Text>
        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm }}>
          <TextInput testID="holiday-date" value={newHoliday.date} onChangeText={v => setNewHoliday({ ...newHoliday, date: v })} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.muted} style={[styles.tinyInput, { flex: 1 }]} />
          <TextInput testID="holiday-label" value={newHoliday.label} onChangeText={v => setNewHoliday({ ...newHoliday, label: v })} placeholder="Descrição" placeholderTextColor={COLORS.muted} style={[styles.tinyInput, { flex: 1.5 }]} />
        </View>
        <Pressable testID="add-holiday" onPress={addHol} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>Adicionar</Text>
        </Pressable>
        {holidays.map(h => (
          <View key={h.id} style={styles.listRow}>
            <Text style={styles.listText}>{h.date} · {h.label}</Text>
            <Pressable onPress={() => delHol(h.id)} testID={`del-holiday-${h.id}`}>
              <Ionicons name="trash-outline" size={16} color={COLORS.error} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

function ServicesTab({ authFetch }: any) {
  const [services, setServices] = useState<Service[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await authFetch('/services');
    if (r.ok) {
      const data = await r.json();
      setServices(data);
      const m: Record<string, string> = {};
      data.forEach((s: Service) => { m[s.id] = String(s.price); });
      setEdits(m);
    }
  }, [authFetch]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const savePrice = async (id: string) => {
    const price = parseFloat(edits[id]);
    if (isNaN(price)) return;
    await authFetch(`/admin/services/${id}`, { method: 'PUT', body: JSON.stringify({ price }) });
    load();
  };

  return (
    <View style={{ gap: SPACING.md }}>
      {services.map(s => (
        <View key={s.id} style={styles.bcard}>
          <Text style={styles.bTitle}>{s.name}</Text>
          <Text style={styles.bMeta}>Valor atual: {formatBRL(s.price)}</Text>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, alignItems: 'center' }}>
            <TextInput
              testID={`svc-price-${s.id}`}
              value={edits[s.id] || ''}
              onChangeText={v => setEdits({ ...edits, [s.id]: v })}
              placeholder="Novo valor"
              placeholderTextColor={COLORS.muted}
              style={[styles.tinyInput, { flex: 1 }]}
              keyboardType="decimal-pad"
            />
            <Pressable testID={`save-price-${s.id}`} onPress={() => savePrice(s.id)} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Salvar</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.lg, paddingBottom: SPACING.md },
  h1: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 24 },
  hSub: { color: COLORS.brand, fontSize: 12, letterSpacing: 1 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: COLORS.error, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.lg, paddingTop: 0, paddingBottom: SPACING.xxxl, gap: SPACING.md },
  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  statCard: {
    flex: 1, backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statLabel: { color: COLORS.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  statValue: { fontFamily: FONTS.displayBold, fontSize: 18, marginTop: 4 },
  tabsRow: { gap: SPACING.sm, paddingVertical: SPACING.sm },
  tab: {
    paddingHorizontal: SPACING.lg, paddingVertical: 8,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border,
    height: 36, justifyContent: 'center',
  },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabText: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  tabTextActive: { color: COLORS.onBrandPrimary, fontWeight: '700' },
  filterRow: { gap: SPACING.sm, paddingVertical: SPACING.sm },
  filterChip: {
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border,
    height: 32, justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: COLORS.brandTertiary, borderColor: COLORS.brand },
  filterText: { color: COLORS.onSurfaceSecondary, fontSize: 12 },
  filterTextActive: { color: COLORS.onBrandTertiary },
  dateFilterRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, marginBottom: SPACING.sm,
  },
  dateInput: { flex: 1, color: COLORS.onSurface, paddingVertical: SPACING.md },
  empty: { color: COLORS.muted, textAlign: 'center', marginTop: SPACING.xl, fontSize: 13 },
  bcard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    gap: 4,
  },
  bcardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.sm },
  bTitle: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 16, flex: 1 },
  bClient: { color: COLORS.brand, fontSize: 13, marginTop: 4 },
  bMeta: { color: COLORS.onSurfaceSecondary, fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
  badgeText: { fontSize: 10, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderRadius: RADIUS.pill, backgroundColor: COLORS.brand,
  },
  actionBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.brand },
  actionText: { color: COLORS.onBrandPrimary, fontSize: 11, fontWeight: '700' },
  tinyInput: {
    color: COLORS.onSurface, fontSize: 14,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  smallBtn: {
    marginTop: SPACING.sm, backgroundColor: COLORS.brand,
    paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center',
  },
  smallBtnText: { color: COLORS.onBrandPrimary, fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  listRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.divider, marginTop: SPACING.sm,
  },
  listText: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.surfaceSecondary,
    borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    padding: SPACING.xl, gap: SPACING.md, paddingBottom: SPACING.xxl,
  },
  modalTitle: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 20, marginBottom: SPACING.sm },
  modalOption: {
    padding: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  modalOptionText: { color: COLORS.onSurface, fontSize: 15 },
});
