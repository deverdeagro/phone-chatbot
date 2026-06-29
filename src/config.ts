/**
 * Dev-only overrides. Keep these `null`/off for normal builds.
 */

/**
 * Force a specific model regardless of device RAM. Useful for smoke-testing the
 * full flow on a lower-RAM device or emulator.
 *   'fallback' → always use the 3B model
 *   'primary'  → always use the 8B model
 *   null       → automatic RAM-based selection (default)
 */
export const DEV_FORCE_MODEL: 'primary' | 'fallback' | null = 'fallback';

/**
 * Azure AD app (client) ID for Microsoft Graph / Outlook sign-in.
 * Register a public client at https://portal.azure.com → App registrations,
 * add redirect URI `com.phonechatbot://oauth2redirect` (Mobile & desktop),
 * and grant delegated permissions: Mail.Read, User.Read, offline_access.
 * Leave empty to hide the "Connect Microsoft" option.
 */
export const AZURE_CLIENT_ID = '';

export const OAUTH_REDIRECT_URL = 'com.phonechatbot://oauth2redirect';

export function isGraphConfigured(): boolean {
  return AZURE_CLIENT_ID.trim().length > 0;
}
