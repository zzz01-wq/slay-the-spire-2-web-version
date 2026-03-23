import type { CharacterDefinition } from '../types.ts'

export const ironcladDefinition: CharacterDefinition = {
  id: 'ironclad',
  name: 'Ironclad',
  title: 'The remaining soldier of the Ironclads.',
  maxHp: 80,
  startingRelicId: 'burning-blood',
  startingDeck: [
    'strike',
    'strike',
    'strike',
    'strike',
    'strike',
    'defend',
    'defend',
    'defend',
    'defend',
    'bash',
  ],
}
