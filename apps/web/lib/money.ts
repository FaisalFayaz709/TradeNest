function minorUnits(amount: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match || match[1] === undefined) return 0n;
  const fraction = (match[2] || '').padEnd(2, '0');
  return BigInt(match[1]) * 100n + BigInt(fraction || '0');
}

export function formatMoney(amount: string, currency: string): string {
  const cents = minorUnits(amount);
  const major = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${currency} ${major.toString()}.${fraction}`;
}

export function multiplyMoney(amount: string, quantity: number): string {
  const total = minorUnits(amount) * BigInt(Math.max(0, Math.trunc(quantity)));
  return `${(total / 100n).toString()}.${(total % 100n).toString().padStart(2, '0')}`;
}

export function sumMoney(amounts: string[]): string {
  const total = amounts.reduce((acc, amount) => acc + minorUnits(amount), 0n);
  return `${(total / 100n).toString()}.${(total % 100n).toString().padStart(2, '0')}`;
}
