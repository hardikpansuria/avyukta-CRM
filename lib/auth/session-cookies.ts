const applicationContextCookies = new Set(["org_context", "sa_context"]);

export function shouldClearExpiredSessionCookie(name: string) {
  return (
    applicationContextCookies.has(name) ||
    /^sb-.+-auth-token(?:\.\d+)?$/.test(name)
  );
}
