export const colors = {
  primary: '#2D6CDF',
  primaryPressed: '#2459B8',

  accent: '#FFB703',
  accentPressed: '#E5A500',

  success: '#16A34A',
  danger: '#DC2626',

  background: '#F7F8FC',
  surface: '#FFFFFF',

  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#6B7280',

  border: '#E5E7EB',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  round: 999,
} as const;

export const typography = {
  title: {
    fontSize: 42,
    fontWeight: '800' as const,
  },

  subtitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '400' as const,
  },

  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400' as const,
  },

  button: {
    fontSize: 20,
    fontWeight: '700' as const,
  },

  caption: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
} as const;