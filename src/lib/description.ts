/** Sentence case without changing the rest of the user's spelling. */
export function capitalizeDescription(value: string): string {
  return value.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase())
}
