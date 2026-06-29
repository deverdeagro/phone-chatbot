import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          {onRetry ? (
            <TouchableOpacity style={styles.retry} onPress={onRetry}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : progress !== undefined ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(Math.min(1, Math.max(0, progress)) * 100)}%
          </Text>
        </View>
      ) : (
        <ActivityIndicator size="large" color="#2563eb" style={styles.spinner} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  spinner: { marginTop: 24 },
  progressWrap: { width: '100%', marginTop: 24, alignItems: 'center' },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  progressText: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  error: {
    marginTop: 20,
    fontSize: 14,
    color: '#b91c1c',
    textAlign: 'center',
  },
  retry: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: '#2563eb',
  },
  retryText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
});
