import {
  ConfidentialClientApplication,
  type ICachePlugin,
} from "@azure/msal-node";
import { AppError } from "@/lib/errors";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";
import { getSupabase } from "@/lib/supabase/admin";

export const GRAPH_SCOPES = [
  "https://graph.microsoft.com/User.Read",
  "https://graph.microsoft.com/Mail.Send",
];

export const GRAPH_READ_SCOPES = [
  ...GRAPH_SCOPES,
  "https://graph.microsoft.com/Mail.Read",
];

type ConnectionRow = {
  account_email: string | null;
  encrypted_cache: string;
};

function requireMicrosoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri || !process.env.TOKEN_ENCRYPTION_KEY) {
    throw new AppError("Microsoft sign-in is not configured.", 503, "microsoft_not_configured");
  }
  return { clientId, clientSecret, redirectUri };
}

function createApp(cacheBox: { value: string }) {
  const { clientId, clientSecret } = requireMicrosoftConfig();
  const cachePlugin: ICachePlugin = {
    beforeCacheAccess: async (context) => {
      if (cacheBox.value) context.tokenCache.deserialize(cacheBox.value);
    },
    afterCacheAccess: async (context) => {
      if (context.cacheHasChanged) cacheBox.value = context.tokenCache.serialize();
    },
  };
  return new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: "https://login.microsoftonline.com/consumers",
    },
    cache: { cachePlugin },
  });
}

export function microsoftRedirectUri() {
  return requireMicrosoftConfig().redirectUri;
}

export async function microsoftAuthUrl(state: string) {
  const { redirectUri } = requireMicrosoftConfig();
  const app = createApp({ value: "" });
  return app.getAuthCodeUrl({
    scopes: GRAPH_READ_SCOPES,
    redirectUri,
    state,
    prompt: "consent",
  });
}

async function readConnection() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("microsoft_connections")
    .select("account_email, encrypted_cache")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new AppError("Outlook status could not be loaded.", 502, "outlook_read_failed");
  return (data as ConnectionRow | null) ?? null;
}

async function writeConnection(accountEmail: string | null, cache: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("microsoft_connections").upsert({
    id: 1,
    account_email: accountEmail,
    encrypted_cache: encryptSecret(cache),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new AppError("Outlook could not be connected.", 502, "outlook_save_failed");
}

export async function outlookStatus() {
  const connection = await readConnection();
  return {
    connected: Boolean(connection),
    accountEmail: connection?.account_email ?? null,
  };
}

export async function disconnectOutlook() {
  const supabase = getSupabase();
  const { error } = await supabase.from("microsoft_connections").delete().eq("id", 1);
  if (error) throw new AppError("Outlook could not be disconnected.", 502, "outlook_disconnect_failed");
}

export async function connectOutlook(code: string) {
  const { redirectUri } = requireMicrosoftConfig();
  const cacheBox = { value: "" };
  const app = createApp(cacheBox);
  const result = await app.acquireTokenByCode({
    code,
    scopes: GRAPH_READ_SCOPES,
    redirectUri,
  });
  if (!cacheBox.value || !result.accessToken) {
    throw new AppError("Microsoft did not return a usable sign-in.", 502, "oauth_failed");
  }
  const accountEmail = result.account?.username ?? null;
  await writeConnection(accountEmail, cacheBox.value);
  return accountEmail;
}

export async function graphAccessToken() {
  return accessToken(GRAPH_SCOPES, "Outlook session expired. Connect Outlook again.");
}

export async function graphReadAccessToken() {
  return accessToken(GRAPH_READ_SCOPES, "Reconnect Outlook to check replies.");
}

async function accessToken(scopes: string[], expiredMessage: string) {
  const connection = await readConnection();
  if (!connection) throw new AppError("Outlook not connected", 409, "outlook_not_connected");

  let cache = "";
  try {
    cache = decryptSecret(connection.encrypted_cache);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(expiredMessage, 401, "oauth_expired");
  }

  const cacheBox = { value: cache };
  const app = createApp(cacheBox);
  try {
    const accounts = await app.getTokenCache().getAllAccounts();
    const account = accounts[0];
    if (!account) {
      throw new AppError(expiredMessage, 401, "oauth_expired");
    }
    const result = await app.acquireTokenSilent({
      account,
      scopes,
    });
    if (!result?.accessToken) {
      throw new AppError(expiredMessage, 401, "oauth_expired");
    }
    if (cacheBox.value !== cache) {
      await writeConnection(result.account?.username ?? connection.account_email, cacheBox.value);
    }
    return result.accessToken;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(expiredMessage, 401, "oauth_expired");
  }
}
