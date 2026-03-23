export function nextSeed(seed: number): number {
  let value = seed + 0x6d2b79f5
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return (value ^ (value >>> 14)) >>> 0
}

export function randomFromSeed(seed: number): { value: number; next: number } {
  const next = nextSeed(seed)
  return {
    value: next / 4294967296,
    next,
  }
}

export function randomIndex(
  seed: number,
  length: number,
): { index: number; next: number } {
  if (length <= 0) {
    return { index: 0, next: seed }
  }

  const { value, next } = randomFromSeed(seed)
  return {
    index: Math.floor(value * length),
    next,
  }
}

export function shuffleWithSeed<T>(
  items: T[],
  seed: number,
): { result: T[]; next: number } {
  const result = [...items]
  let next = seed

  for (let index = result.length - 1; index > 0; index -= 1) {
    const roll = randomIndex(next, index + 1)
    next = roll.next
    const swapIndex = roll.index
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }

  return { result, next }
}
