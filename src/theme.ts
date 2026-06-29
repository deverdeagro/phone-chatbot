import { Platform, type ViewStyle } from 'react-native';

/**
 * Central design tokens so the whole app shares one cohesive, modern look.
 */
export const colors = {
  bg: '#FFFFFF',
  surface: '#F8FAFC',
  surfaceAlt: '#F1F5F9',
  border: '#E8ECF2',

  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primarySoft: '#EEF0FF',
  onPrimary: '#FFFFFF',

  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',

  assistantBubble: '#F1F5F9',
  userBubble: '#4F46E5',

  success: '#059669',
  successSoft: '#ECFDF5',
  danger: '#DC2626',
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

/** 4-pt spacing scale. */
export const space = (n: number) => n * 4;

/** Soft elevation shadow (Android elevation + iOS shadow). */
export function shadow(level: 1 | 2 | 3): ViewStyle {
  const map = {
    1: { elevation: 2, radius: 6, opacity: 0.08, y: 2 },
    2: { elevation: 5, radius: 12, opacity: 0.1, y: 4 },
    3: { elevation: 10, radius: 24, opacity: 0.14, y: 8 },
  } as const;
  const s = map[level];
  return Platform.select({
    android: { elevation: s.elevation },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: s.y },
      shadowRadius: s.radius,
      shadowOpacity: s.opacity,
    },
  }) as ViewStyle;
}
