/** Complement of each IUPAC nucleotide code (ambiguity codes map to their complementary set). */
const COMPLEMENT: Record<string, string> = {
  A: 'T', T: 'A', U: 'A', G: 'C', C: 'G',
  R: 'Y', Y: 'R', S: 'S', W: 'W', K: 'M', M: 'K',
  B: 'V', V: 'B', D: 'H', H: 'D', N: 'N',
}

/** Complementary base; characters without one (gaps, stops) are returned unchanged. */
export function complementBase(base: string): string {
  const upper = base.toUpperCase()
  const out = COMPLEMENT[upper] ?? base
  return base === upper ? out : out.toLowerCase()
}

/** Complementary strand in the same left-to-right order (read 3'→5'). */
export function complement(sequence: string): string {
  let out = ''
  for (const base of sequence) out += complementBase(base)
  return out
}

export function reverseComplement(sequence: string): string {
  return complement(sequence).split('').reverse().join('')
}
