/**
 * Returns the application base URL from the NEXT_PUBLIC_BASE_URL env var.
 * Throws in production when the variable is missing so broken links are
 * caught at request time instead of silently using localhost.
 */
export function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_BASE_URL;
  if (url) return url;

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  throw new Error(
    "NEXT_PUBLIC_BASE_URL is required in production. Set it in your Vercel project environment variables."
  );
}
