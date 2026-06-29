import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  clearGmailCredentials,
  getGmailCredentials,
  saveGmailCredentials,
} from './credentials';
import { searchGmail } from './imapClient';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Notifies the parent whether Gmail is connected after changes. */
  onConnectedChange: (connected: boolean) => void;
};

export function GmailConnectModal({
  visible,
  onClose,
  onConnectedChange,
}: Props) {
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setError(null);
    getGmailCredentials().then(creds => {
      setConnectedEmail(creds?.email ?? null);
      if (creds) {
        setEmail(creds.email);
      }
    });
  }, [visible]);

  const onConnect = async () => {
    const trimmedEmail = email.trim();
    const password = appPassword.replace(/\s+/g, ''); // app passwords are shown with spaces
    if (!trimmedEmail || !password) {
      setError('Enter your Gmail address and a 16-character App Password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Verify the credentials actually work before saving them.
      await searchGmail(trimmedEmail, password, 'newer_than:1d', 1);
      await saveGmailCredentials({ email: trimmedEmail, appPassword: password });
      setConnectedEmail(trimmedEmail);
      setAppPassword('');
      onConnectedChange(true);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Couldn't sign in: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    await clearGmailCredentials();
    setConnectedEmail(null);
    setEmail('');
    setAppPassword('');
    onConnectedChange(false);
    setBusy(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Connect Gmail</Text>

          {connectedEmail ? (
            <Text style={styles.connected}>
              Connected as {connectedEmail}
            </Text>
          ) : (
            <Text style={styles.help}>
              Use a Google{' '}
              <Text
                style={styles.link}
                onPress={() =>
                  Linking.openURL('https://myaccount.google.com/apppasswords')
                }>
                App Password
              </Text>{' '}
              (needs 2-Step Verification). Your password is stored only on this
              device.
            </Text>
          )}

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@gmail.com"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            value={appPassword}
            onChangeText={setAppPassword}
            placeholder="16-character App Password"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            editable={!busy}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            onPress={onConnect}
            disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {connectedEmail ? 'Update connection' : 'Connect'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            {connectedEmail ? (
              <TouchableOpacity onPress={onDisconnect} disabled={busy}>
                <Text style={styles.disconnect}>Disconnect</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <TouchableOpacity onPress={onClose} disabled={busy}>
              <Text style={styles.cancel}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  connected: { fontSize: 14, color: '#059669', marginBottom: 12 },
  help: { fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 18 },
  link: { color: '#4F46E5', textDecorationLine: 'underline' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    marginTop: 10,
  },
  error: { color: '#b91c1c', fontSize: 13, marginTop: 10 },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: '#4F46E5',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  disconnect: { color: '#b91c1c', fontSize: 15 },
  cancel: { color: '#6b7280', fontSize: 15 },
});
