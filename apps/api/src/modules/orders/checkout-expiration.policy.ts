/** Order payment TTL: a product policy, not a new order/escrow state. */
export function checkoutPaymentTtlMinutes(source: string | undefined = process.env.CHECKOUT_PAYMENT_TTL_MINUTES): number {
  if (source === undefined || source === '') return 30;
  if (!/^[1-9]\d*$/.test(source)) throw new Error('CHECKOUT_PAYMENT_TTL_MINUTES must be an integer from 5 to 1440.');
  const minutes = Number(source);
  if (!Number.isSafeInteger(minutes) || minutes < 5 || minutes > 1440) {
    throw new Error('CHECKOUT_PAYMENT_TTL_MINUTES must be an integer from 5 to 1440.');
  }
  return minutes;
}
export function checkoutPaymentDeadline(now: Date = new Date(), minutes = checkoutPaymentTtlMinutes()): Date {
  return new Date(now.getTime() + minutes * 60_000);
}

export function checkoutSweepSeconds(source: string | undefined = process.env.CHECKOUT_EXPIRY_SWEEP_SECONDS): number {
  if (source === undefined || source === '') return 60;
  if (!/^[1-9]\d*$/.test(source)) throw new Error('CHECKOUT_EXPIRY_SWEEP_SECONDS must be an integer from 10 to 3600.');
  const seconds = Number(source);
  if (!Number.isSafeInteger(seconds) || seconds < 10 || seconds > 3600) {
    throw new Error('CHECKOUT_EXPIRY_SWEEP_SECONDS must be an integer from 10 to 3600.');
  }
  return seconds;
}
