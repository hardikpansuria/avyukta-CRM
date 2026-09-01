export function safeLegalReturnPath(value: string | null | undefined) {
  if (!value || value.length > 2_000) {
    return "/dashboard";
  }

  if (
    !value.startsWith("/dashboard") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return "/dashboard";
  }

  return value;
}
