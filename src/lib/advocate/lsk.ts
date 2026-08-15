/** Normalize LSK practising numbers for comparison */
export function normalizeLskNumber(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export function lskNumbersEqual(a: string, b: string): boolean {
  return normalizeLskNumber(a) === normalizeLskNumber(b);
}
