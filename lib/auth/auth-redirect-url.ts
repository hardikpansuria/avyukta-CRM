export function buildAuthRedirectUrl(siteUrl: string, path: string) {
  const baseUrl = new URL(siteUrl);

  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    throw new Error("Site URL must use HTTP or HTTPS.");
  }

  return new URL(path, baseUrl.origin).toString();
}
