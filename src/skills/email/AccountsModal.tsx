import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, shadow, space } from '../../theme';
import { isGraphConfigured } from '../../config';
import {
  addAccount,
  getAccounts,
  newAccountId,
  removeAccount,
  updateAccount,
} from './accountsStore';
import { verifyImapAccount } from './imapClient';
import { signInMicrosoft } from './graph/graphAuth';
import { presetForEmail } from './providers';
import type { EmailAccount } from './types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAccountsChange: (count: number) => void;
};

const blankForm = {
  label: '',
  email: '',
  host: '',
  port: '993',
  ssl: true,
  username: '',
  password: '',
};

export function AccountsModal({ visible, onClose, onAccountsChange }: Props) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [view, setView] = useState<'list' | 'addImap'>('list');
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const all = await getAccounts();
    setAccounts(all);
    onAccountsChange(all.filter(a => a.isActive).length);
  }, [onAccountsChange]);

  useEffect(() => {
    if (visible) {
      setView('list');
      setError(null);
      reload();
    }
  }, [visible, reload]);

  const onToggleActive = async (acc: EmailAccount) => {
    await updateAccount(acc.id, { isActive: !acc.isActive });
    reload();
  };

  const onDelete = async (acc: EmailAccount) => {
    await removeAccount(acc.id);
    reload();
  };

  const onConnectMicrosoft = async () => {
    setBusy(true);
    setError(null);
    try {
      const { email, refreshToken } = await signInMicrosoft();
      await addAccount({
        id: newAccountId(),
        label: 'Outlook',
        emailAddress: email,
        authType: 'graph',
        imapHost: '',
        imapPort: 993,
        imapUseSsl: true,
        username: '',
        password: '',
        graphRefreshToken: refreshToken,
        isActive: true,
        createdAt: Date.now(),
      });
      await reload();
    } catch (e) {
      setError(`Microsoft sign-in failed: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const onEmailBlur = () => {
    const preset = presetForEmail(form.email);
    if (preset && !form.host) {
      setForm(f => ({
        ...f,
        host: preset.host,
        port: String(preset.port),
        ssl: preset.ssl,
      }));
    }
  };

  const onSaveImap = async () => {
    const email = form.email.trim();
    const host = form.host.trim();
    const password = form.password.replace(/\s+/g, '');
    if (!email || !host || !password) {
      setError('Email, IMAP host, and password are required.');
      return;
    }
    const account: EmailAccount = {
      id: newAccountId(),
      label: form.label.trim() || email,
      emailAddress: email,
      authType: 'imap',
      imapHost: host,
      imapPort: parseInt(form.port, 10) || 993,
      imapUseSsl: form.ssl,
      username: form.username.trim() || email,
      password,
      isActive: true,
      createdAt: Date.now(),
    };
    setBusy(true);
    setError(null);
    try {
      await verifyImapAccount(account);
      await addAccount(account);
      setForm(blankForm);
      setView('list');
      await reload();
    } catch (e) {
      setError(`Couldn't connect: ${msg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {view === 'list' ? 'Email accounts' : 'Add IMAP account'}
            </Text>
            <TouchableOpacity onPress={view === 'list' ? onClose : () => setView('list')}>
              <Text style={styles.headerAction}>
                {view === 'list' ? 'Done' : 'Back'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {view === 'list' ? (
              <>
                {accounts.length === 0 ? (
                  <Text style={styles.empty}>
                    No accounts yet. Add one to let the assistant search your email.
                  </Text>
                ) : (
                  accounts.map(acc => (
                    <View key={acc.id} style={styles.accountRow}>
                      <View style={styles.accountInfo}>
                        <View style={styles.accountTopline}>
                          <Text style={styles.accountLabel}>{acc.label}</Text>
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                              {acc.authType === 'graph' ? 'Microsoft' : 'IMAP'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.accountEmail}>{acc.emailAddress}</Text>
                        <TouchableOpacity onPress={() => onDelete(acc)}>
                          <Text style={styles.remove}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                      <Switch
                        value={acc.isActive}
                        onValueChange={() => onToggleActive(acc)}
                        trackColor={{ true: colors.primary, false: colors.border }}
                        thumbColor={colors.bg}
                      />
                    </View>
                  ))
                )}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    setError(null);
                    setForm(blankForm);
                    setView('addImap');
                  }}
                  disabled={busy}>
                  <Text style={styles.primaryBtnText}>+ Add IMAP account</Text>
                </TouchableOpacity>

                {isGraphConfigured() ? (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, busy && styles.btnDisabled]}
                    onPress={onConnectMicrosoft}
                    disabled={busy}>
                    {busy ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Text style={styles.secondaryBtnText}>
                        Connect Microsoft (Outlook / 365)
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.note}>
                    Microsoft / Outlook sign-in is available once an Azure client ID
                    is configured.
                  </Text>
                )}
              </>
            ) : (
              <View style={styles.form}>
                <Text style={styles.help}>
                  For Gmail/Yahoo/iCloud, generate an{' '}
                  <Text
                    style={styles.link}
                    onPress={() =>
                      Linking.openURL(
                        'https://support.google.com/accounts/answer/185833',
                      )
                    }>
                    app password
                  </Text>
                  . Your credentials are stored only on this device.
                </Text>

                <Field
                  label="Label (optional)"
                  value={form.label}
                  onChangeText={t => setForm(f => ({ ...f, label: t }))}
                  placeholder="Work, Personal…"
                />
                <Field
                  label="Email address"
                  value={form.email}
                  onChangeText={t => setForm(f => ({ ...f, email: t }))}
                  onBlur={onEmailBlur}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                />
                <View style={styles.row2}>
                  <View style={styles.flex2}>
                    <Field
                      label="IMAP host"
                      value={form.host}
                      onChangeText={t => setForm(f => ({ ...f, host: t }))}
                      placeholder="imap.example.com"
                    />
                  </View>
                  <View style={styles.flex1}>
                    <Field
                      label="Port"
                      value={form.port}
                      onChangeText={t => setForm(f => ({ ...f, port: t }))}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <View style={styles.sslRow}>
                  <Text style={styles.fieldLabel}>Use SSL/TLS</Text>
                  <Switch
                    value={form.ssl}
                    onValueChange={v => setForm(f => ({ ...f, ssl: v }))}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    thumbColor={colors.bg}
                  />
                </View>
                <Field
                  label="Username (optional)"
                  value={form.username}
                  onChangeText={t => setForm(f => ({ ...f, username: t }))}
                  placeholder="defaults to email"
                />
                <Field
                  label="Password / app password"
                  value={form.password}
                  onChangeText={t => setForm(f => ({ ...f, password: t }))}
                  secureTextEntry
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.primaryBtn, busy && styles.btnDisabled]}
                  onPress={onSaveImap}
                  disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify & save</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        onBlur={props.onBlur}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space(5),
    paddingTop: space(4),
    paddingBottom: space(8),
    maxHeight: '88%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space(3),
  },
  title: { fontSize: 19, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  headerAction: { fontSize: 16, fontWeight: '600', color: colors.primary },
  empty: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginVertical: space(3),
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accountInfo: { flex: 1, paddingRight: space(3) },
  accountTopline: { flexDirection: 'row', alignItems: 'center' },
  accountLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  badge: {
    marginLeft: space(2),
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: space(2),
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  accountEmail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  remove: { fontSize: 13, color: colors.danger, marginTop: space(1.5) },
  primaryBtn: {
    marginTop: space(5),
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: space(3.5),
    alignItems: 'center',
    ...shadow(2),
  },
  primaryBtnText: { color: colors.onPrimary, fontWeight: '600', fontSize: 16 },
  secondaryBtn: {
    marginTop: space(3),
    borderRadius: radius.pill,
    paddingVertical: space(3.5),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
  note: {
    marginTop: space(3),
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: space(3), lineHeight: 18 },
  form: { paddingTop: space(2) },
  help: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: space(3) },
  link: { color: colors.primary, textDecorationLine: 'underline' },
  field: { marginBottom: space(3) },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: space(1.5) },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  row2: { flexDirection: 'row' },
  flex2: { flex: 2, marginRight: space(3) },
  flex1: { flex: 1 },
  sslRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space(3),
  },
});
