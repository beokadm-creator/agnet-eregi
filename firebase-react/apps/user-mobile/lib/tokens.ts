/**
 * Hodu Design Tokens — React Native bridge
 * Source: design/tokens.jsx — do not edit values here; update tokens.jsx first.
 */

export const T = Object.freeze({
  paper: '#FAF8F4',
  paperAlt: '#F4F1EA',
  canvas: '#FFFFFF',
  ink: '#0A0A0A',
  ink2: '#2C2C2E',
  graphite: '#46474C',
  slate: '#76767E',
  fog: '#A6A6AC',
  hairline: '#E9E5DC',
  hairlineStrong: '#D9D3C5',
  surfaceMuted: '#F1ECE0',

  accent: '#D87242',
  accentHover: '#BC5C30',
  accentSoft: '#FDEDE2',
  accentInk: '#5C2A12',
  accentDeep: '#923D1B',

  success: '#1F9D55',
  successSoft: '#E5F5EC',
  warning: '#E0A019',
  warningSoft: '#FBF1D9',
  danger: '#D1372B',
  dangerSoft: '#FBE8E5',
  info: '#2F6FE0',
  infoSoft: '#E6EEFB',
});

export const R = Object.freeze({
  r1: 8,
  r2: 14,
  r3: 20,
  r4: 28,
  btn: 12,
  pill: 999,
});

export const S = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
});

export const BH = Object.freeze({
  sm: 34,
  default: 44,
  lg: 56,
  xl: 64,
});

export const FS = Object.freeze({
  xs: 11,
  sm: 12,
  label: 13,
  body: 14,
  md: 15,
  subheading: 17,
  title: 20,
  h3: 22,
  h2: 28,
  h1: 36,
  hero: 44,
});

export const FW = Object.freeze({
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
});

export const Shadows = Object.freeze({
  sm: {
    shadowColor: '#0a0a0a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0a0a0a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0a0a0a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
});
