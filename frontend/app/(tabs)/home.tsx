import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ImageBackground, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, formatBRL, modalityLabel } from '@/src/theme';
import { useAuth } from '@/src/auth';
import Logo from '@/src/Logo';

type Service = {
  id: string;
  name: string;
  short_desc: string;
  price: number;
  modalities: string[];
  image: string;
};

export default function Home() {
  const { user, authFetch } = useAuth();
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await authFetch('/services');
      const data = await r.json();
      setServices(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [authFetch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.brand} />}
      >
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
            <Logo size={44} />
            <View>
              <Text style={styles.hi}>Bem-vindo(a),</Text>
              <Text style={styles.name} numberOfLines={1} testID="home-user-name">{user?.full_name?.split(' ')[0]}</Text>
            </View>
          </View>
        </View>

        <View style={styles.introBlock}>
          <Text style={styles.introTitle}>Consultas Espirituais</Text>
          <View style={styles.divider} />
          <Text style={styles.introText}>Escolha o atendimento desejado abaixo.</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.brand} style={{ marginTop: SPACING.xxl }} />
        ) : (
          <View style={{ gap: SPACING.lg }}>
            {services.map((svc) => (
              <ServiceCard key={svc.id} svc={svc} onPress={() => router.push(`/service/${svc.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ServiceCard({ svc, onPress }: { svc: Service; onPress: () => void }) {
  return (
    <Pressable
      testID={`service-card-${svc.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <ImageBackground source={{ uri: svc.image }} style={styles.cardBg} imageStyle={{ borderRadius: RADIUS.lg }}>
        <LinearGradient
          colors={['rgba(15,15,15,0.05)', 'rgba(15,15,15,0.65)', 'rgba(15,15,15,0.95)']}
          style={styles.cardScrim}
        />
        <View style={styles.cardContent}>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>{formatBRL(svc.price)}</Text>
          </View>
          <Text style={styles.cardTitle}>{svc.name}</Text>
          <Text style={styles.cardDesc} numberOfLines={2}>{svc.short_desc}</Text>
          <View style={styles.cardFooter}>
            <View style={styles.modalityWrap}>
              {svc.modalities.map(m => (
                <View key={m} style={styles.modalityPill}>
                  <Text style={styles.modalityText}>{modalityLabel(m)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.arrow}>
              <Ionicons name="arrow-forward" size={18} color={COLORS.brand} />
            </View>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  hi: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 1.2 },
  name: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 22, maxWidth: 220 },
  introBlock: { marginBottom: SPACING.xl, gap: SPACING.xs },
  introTitle: { color: COLORS.brand, fontFamily: FONTS.displayBold, fontSize: 24 },
  divider: { width: 40, height: 1, backgroundColor: COLORS.brand },
  introText: { color: COLORS.onSurfaceTertiary, fontSize: 13, marginTop: SPACING.xs },
  card: {
    borderRadius: RADIUS.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
  },
  cardBg: { height: 260, justifyContent: 'flex-end' },
  cardScrim: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.lg },
  cardContent: { padding: SPACING.lg, gap: SPACING.xs },
  priceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brand,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderRadius: RADIUS.pill,
    marginBottom: SPACING.xs,
  },
  priceText: { color: COLORS.onBrandPrimary, fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  cardTitle: { color: COLORS.onSurface, fontFamily: FONTS.displayBold, fontSize: 22 },
  cardDesc: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm },
  modalityWrap: { flexDirection: 'row', gap: SPACING.xs },
  modalityPill: {
    borderWidth: 1, borderColor: COLORS.brand, borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  modalityText: { color: COLORS.brand, fontSize: 11, letterSpacing: 0.5 },
  arrow: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: COLORS.brand,
    alignItems: 'center', justifyContent: 'center',
  },
});
