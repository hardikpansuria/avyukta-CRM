export function moneyToCents(value: string | number | null | undefined) {
  const normalized = String(value ?? "0").trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error(`Invalid currency amount: ${normalized}`);

  const [, sign, whole, fraction = ""] = match;
  const cents =
    BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return sign === "-" ? -cents : cents;
}

export function centsToMoney(cents: bigint) {
  const zero = BigInt(0);
  const hundred = BigInt(100);
  const sign = cents < zero ? "-" : "";
  const absolute = cents < zero ? -cents : cents;
  const whole = absolute / hundred;
  const fraction = String(absolute % hundred).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}
