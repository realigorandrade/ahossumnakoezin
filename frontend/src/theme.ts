export const COLORS = {
  surface: '#0F0F0F',
  onSurface: '#F7F5F0',
  surfaceSecondary: '#1C1A17',
  onSurfaceSecondary: '#E8E4D9',
  surfaceTertiary: '#26231E',
  onSurfaceTertiary: '#D1CCBF',
  surfaceInverse: '#F7F5F0',
  onSurfaceInverse: '#0F0F0F',
  brand: '#D4AF37',
  brandPrimary: '#D4AF37',
  onBrandPrimary: '#0F0F0F',
  brandSecondary: '#AA8327',
  onBrandSecondary: '#F7F5F0',
  brandTertiary: '#3B311B',
  onBrandTertiary: '#E8D18C',
  success: '#2D4A32',
  onSuccess: '#8CE8A0',
  warning: '#5C4515',
  onWarning: '#F0C873',
  error: '#4A2424',
  onError: '#E89292',
  info: '#332F29',
  onInfo: '#E0DFDC',
  border: '#2E2A24',
  borderStrong: '#4F483D',
  divider: '#211E1A',
  muted: '#8A8578',
};

export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
};

export const RADIUS = { sm: 6, md: 12, lg: 20, pill: 999 };

export const FONTS = {
  displayRegular: 'Cormorant-Regular',
  displayBold: 'Cormorant-Bold',
  body: 'System',
};

export const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export function formatBRL(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

export function statusInfo(status: string) {
  switch (status) {
    case 'aguardando_pagamento':
      return { label: 'Aguardando pagamento', bg: COLORS.warning, fg: COLORS.onWarning };
    case 'confirmado':
      return { label: 'Confirmado', bg: COLORS.success, fg: COLORS.onSuccess };
    case 'concluido':
      return { label: 'Concluído', bg: COLORS.surfaceTertiary, fg: COLORS.onSurfaceTertiary };
    case 'cancelado':
      return { label: 'Cancelado', bg: COLORS.error, fg: COLORS.onError };
    default:
      return { label: status, bg: COLORS.info, fg: COLORS.onInfo };
  }
}

export function modalityLabel(m: string) {
  return m === 'presencial' ? 'Presencial' : 'Online';
}
