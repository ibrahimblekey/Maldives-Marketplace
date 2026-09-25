/** "USD 85" or "USD 85.50" — whole amounts without the trailing .00. */
export function formatCents(cents: number, currency: string) {
  const amount = cents / 100;
  return `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
