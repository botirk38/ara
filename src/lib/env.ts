/**
 * Returns the configured base URL for the application.
 * Uses NEXT_PUBLIC_BASE_URL in production and VERCEL_URL as a fallback
 * for Vercel preview deployments. Throws if neither is set so that
 * broken payment links and webhook URLs surface immediately instead of
 * silently pointing at localhost.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  throw new Error(
    "NEXT_PUBLIC_BASE_URL is required. Set it in your environment variables."
  );
}

/**
 * Non-throwing variant for notification contexts where a broken link
 * is preferable to a failed notification (e.g. Slack messages).
 */
export function getBaseUrlOrFallback(): string {
  try {
    return getBaseUrl();
  } catch {
    return "http://localhost:3000";
  }
}
