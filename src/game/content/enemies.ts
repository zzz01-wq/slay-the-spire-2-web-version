import type {
  EncounterDefinition,
  EnemyDefinition,
  EnemyId,
} from '../types.ts'

export const enemyDefinitions: Record<EnemyId, EnemyDefinition> = {
  cultist: {
    id: 'cultist',
    name: 'Cultist',
    maxHp: 50,
    goldReward: 14,
    intentCycle: [
      { label: 'Incantation: gain 3 Ritual', gainRitual: 3 },
      { label: 'Dark Strike for 6', damage: 6 },
    ],
  },
  'jaw-worm': {
    id: 'jaw-worm',
    name: 'Jaw Worm',
    maxHp: 42,
    goldReward: 16,
    intentCycle: [
      { label: 'Chomp for 11', damage: 11 },
      { label: 'Bellow: gain 3 Strength and 6 Block', block: 6, gainStrength: 3 },
      { label: 'Thrash for 7 and gain 5 Block', damage: 7, block: 5 },
    ],
  },
  'red-louse': {
    id: 'red-louse',
    name: 'Red Louse',
    maxHp: 13,
    goldReward: 8,
    intentCycle: [
      { label: 'Bite for 6', damage: 6 },
      { label: 'Grow: gain 3 Strength', gainStrength: 3 },
      { label: 'Bite for 6', damage: 6 },
    ],
    passive: {
      curlUpBlock: 4,
    },
  },
  'green-louse': {
    id: 'green-louse',
    name: 'Green Louse',
    maxHp: 14,
    goldReward: 8,
    intentCycle: [
      { label: 'Bite for 6', damage: 6 },
      { label: 'Spit Web: apply 2 Weak', applyWeak: 2 },
      { label: 'Bite for 6', damage: 6 },
    ],
    passive: {
      curlUpBlock: 4,
    },
  },
  'fungi-beast': {
    id: 'fungi-beast',
    name: 'Fungi Beast',
    maxHp: 26,
    goldReward: 10,
    intentCycle: [
      { label: 'Bite for 6', damage: 6 },
      { label: 'Grow: gain 3 Strength', gainStrength: 3 },
      { label: 'Bite for 6', damage: 6 },
    ],
    passive: {
      onDeathApplyVulnerable: 2,
    },
  },
}

export const encounterDefinitions: Record<string, EncounterDefinition> = {
  'solo-cultist': {
    id: 'solo-cultist',
    name: 'Lonely Prayer',
    description: 'A single cultist blocks the hall and begins chanting.',
    enemyIds: ['cultist'],
  },
  'louse-pack': {
    id: 'louse-pack',
    name: 'Louse Pack',
    description: 'Two skittering louses dart between the broken stones.',
    enemyIds: ['red-louse', 'green-louse'],
  },
  'jaw-worm': {
    id: 'jaw-worm',
    name: 'Gnashing Ambush',
    description: 'A jaw worm surges from the rubble, all teeth and muscle.',
    enemyIds: ['jaw-worm'],
  },
  'fungi-cult': {
    id: 'fungi-cult',
    name: 'Spores and Caws',
    description: 'A cultist marches beside a fungi beast in a foul duet.',
    enemyIds: ['cultist', 'fungi-beast'],
  },
}
