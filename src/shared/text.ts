/**
 * Matn yordamchilari.
 */

export function joinSummary(lines: string[], fallback = 'o‘zgarish yo‘q'): string {
  return lines.length === 0 ? fallback : lines.join('; ');
}
