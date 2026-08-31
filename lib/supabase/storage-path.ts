export function isOrgScopedStoragePath(path: string, orgId: string) {
  if (!path.startsWith(`${orgId}/`) || path.includes("\\")) return false;

  return path
    .split("/")
    .every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}
