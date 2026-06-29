import { authorize, refresh, type AuthConfiguration } from 'react-native-app-auth';
import { AZURE_CLIENT_ID, OAUTH_REDIRECT_URL } from '../../../config';

const SCOPES = ['openid', 'profile', 'offline_access', 'User.Read', 'Mail.Read'];

function config(): AuthConfiguration {
  return {
    clientId: AZURE_CLIENT_ID,
    redirectUrl: OAUTH_REDIRECT_URL,
    scopes: SCOPES,
    serviceConfiguration: {
      authorizationEndpoint:
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenEndpoint:
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    },
  };
}

export type MicrosoftSignIn = {
  email: string;
  refreshToken: string;
};

/** Launch the Microsoft sign-in flow and return the account email + refresh token. */
export async function signInMicrosoft(): Promise<MicrosoftSignIn> {
  const result = await authorize(config());
  if (!result.refreshToken) {
    throw new Error('Microsoft did not return a refresh token.');
  }
  const email =
    emailFromIdToken(result.idToken) || 'Microsoft account';
  return { email, refreshToken: result.refreshToken };
}

/** Exchange a stored refresh token for a fresh access token. */
export async function getGraphAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const result = await refresh(config(), { refreshToken });
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken || refreshToken,
  };
}

/** Pull the user's email out of the OIDC id_token (no verification needed here). */
function emailFromIdToken(idToken?: string): string {
  if (!idToken) {
    return '';
  }
  try {
    const payload = idToken.split('.')[1];
    const json = decodeBase64Url(payload);
    const claims = JSON.parse(json) as {
      preferred_username?: string;
      email?: string;
      upn?: string;
    };
    return claims.preferred_username || claims.email || claims.upn || '';
  } catch {
    return '';
  }
}

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  const binary = atobFn ? atobFn(padded) : padded;
  try {
    return decodeURIComponent(escape(binary));
  } catch {
    return binary;
  }
}
