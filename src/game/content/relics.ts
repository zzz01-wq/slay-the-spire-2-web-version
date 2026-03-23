import type { RelicDefinition, RelicId } from '../types.ts'

export const relicDefinitions: Record<RelicId, RelicDefinition> = {
  'burning-blood': {
    id: 'burning-blood',
    name: 'Burning Blood',
    description: 'Heal for 6 HP at the end of combat.',
    trigger: 'combatEnd',
    healAmount: 6,
  },
}
