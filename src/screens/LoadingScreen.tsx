import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, shadow, space } from '../theme';

const ICON = require('../assets/icon.png');

type Props = {
  title: string;
  subtitle?: string;
  /** 0..1 progress; when provided a bar is shown. */
  progress?: number;
  /** When set, shows an error state with a retry button. */
  error?: string;
  onRetry?: () => void;
};

export function LoadingScreen({
  title,
  subtitle,
  progress,
  error,
  onRetry,
}: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, progress ?? 0)) * 100);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Image source={ICON} style={styles.logo} resizeMode="cover" />
      </View>

      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.indicator}>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            {onRetry ? (
              <TouchableOpacity style={styles.retry} onPress={onRetry}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : progress !== undefined ? (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.pct}>{pct}%</Text>
          </>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(8),
    backgroundColor: colors.bg,
  },
  logoWrap: {
    width: 92,
    height: 92,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: space(6),
    backgroundColor: colors.primarySoft,
    ...shadow(3),
  },
  logo: { width: '100%', height: '100%' },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: space(2),
    lineHeight: 20,
  },
  indicator: {
    marginTop: space(7),
    width: '100%',
    alignItems: 'center',
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  pct: {
    marginTop: space(3),
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  error: {
    fontSize: 14,
    color: colors.danger,
    textAlign: 'center',
    lineHeight: 20,
  },
  retry: {
    marginTop: space(5),
    paddingHorizontal: space(6),
    paddingVertical: space(3),
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow(2),
  },
  retryText: { color: colors.onPrimary, fontWeight: '600', fontSize: 16 },
});
