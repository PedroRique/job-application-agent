export function integrationFlags() {
  return {
    database: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    microsoftApp: Boolean(
      process.env.MICROSOFT_CLIENT_ID &&
        process.env.MICROSOFT_CLIENT_SECRET &&
        process.env.MICROSOFT_REDIRECT_URI &&
        process.env.TOKEN_ENCRYPTION_KEY,
    ),
    appLock: Boolean(
      (process.env.APP_PASSWORD?.length ?? 0) >= 8 &&
        (process.env.SESSION_SECRET?.length ?? 0) >= 16,
    ),
  };
}
