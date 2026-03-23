import type { GameState } from '../types.ts'

export function serializeRun(state: GameState): string {
  return JSON.stringify(state)
}

export function hydrateRun(snapshot: string): GameState {
  return JSON.parse(snapshot) as GameState
}
