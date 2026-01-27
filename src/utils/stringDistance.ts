/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []

  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Find N closest words by Levenshtein distance
 */
export function findClosestWords(target: string, words: string[], n: number): string[] {
  return words
    .filter(w => w !== target)
    .map(word => ({ word, distance: levenshtein(target, word) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, n)
    .map(item => item.word)
}
