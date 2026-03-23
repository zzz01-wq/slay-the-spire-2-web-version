export type Screen =
  | 'title'
  | 'map'
  | 'combat'
  | 'reward'
  | 'rest'
  | 'shop'
  | 'victory'
  | 'defeat'

export type NodeKind = 'combat' | 'rest' | 'shop'
export type CharacterId = 'ironclad'
export type CardId =
  | 'strike'
  | 'defend'
  | 'bash'
  | 'anger'
  | 'armaments'
  | 'blood-wall'
  | 'bloodletting'
  | 'body-slam'
  | 'breakthrough'
  | 'cinder'
  | 'crimson-mantle'
  | 'dark-embrace'
  | 'demon-form'
  | 'entrench'
  | 'evil-eye'
  | 'expect-a-fight'
  | 'feel-no-pain'
  | 'feed'
  | 'fiend-fire'
  | 'fight-me'
  | 'flame-barrier'
  | 'havoc'
  | 'headbutt'
  | 'inferno'
  | 'inflame'
  | 'iron-wave'
  | 'impervious'
  | 'juggernaut'
  | 'molten-fist'
  | 'perfected-strike'
  | 'pommel-strike'
  | 'rupture'
  | 'setup-strike'
  | 'shrug-it-off'
  | 'sword-boomerang'
  | 'thunderclap'
  | 'tremble'
  | 'true-grit'
  | 'twin-strike'
  | 'ashen-strike'
  | 'bludgeon'
  | 'bully'
  | 'burning-pact'
export type CardType = 'attack' | 'skill' | 'power'
export type CardRarity = 'starter' | 'common' | 'uncommon' | 'rare'
export type RelicId = 'burning-blood'
export type EnemyId =
  | 'cultist'
  | 'jaw-worm'
  | 'red-louse'
  | 'green-louse'
  | 'fungi-beast'
export type StatusName = 'vulnerable' | 'weak'
export type Tone = 'neutral' | 'good' | 'bad'

export type CardEffect = {
  damage?: number
  damageAll?: number
  hits?: number
  randomTarget?: boolean
  targetEnemy?: boolean
  damageEqualsBlock?: boolean
  block?: number
  doubleBlock?: boolean
  bonusBlockIfExhaustedThisTurn?: number
  applyVulnerable?: number
  applyVulnerableAll?: number
  applyWeak?: number
  drawCards?: number
  loseHpSelf?: number
  gainEnemyStrength?: number
  gainTemporaryStrength?: number
  scaleWithStrikeCards?: number
  scaleWithExhaustPile?: number
  scaleWithEnemyVulnerable?: number
  doubleEnemyVulnerable?: boolean
  createCopyInDiscard?: boolean
  exhaustTopDrawPile?: number
  playTopDrawPileAndExhaust?: boolean
  gainEnergy?: number
  gainEnergyPerAttackInHand?: number
  gainStrength?: number
  gainStrengthPerHpLossFromCard?: number
  gainStrengthPerTurn?: number
  feelNoPainBlock?: number
  darkEmbraceDraw?: number
  juggernautDamage?: number
  infernoDamage?: number
  crimsonMantleBlock?: number
  upgradeChosenHandCard?: boolean
  upgradeAllHand?: boolean
  moveDiscardToDrawTop?: boolean
  exhaustChosenHandCard?: boolean
  exhaustRandomHandCard?: boolean
  drawCardsAfterChosenExhaust?: number
  exhaustEntireHandForDamage?: number
  exhaustSelf?: boolean
  retaliateDamageThisTurn?: number
  fatalMaxHpGain?: number
}

export type CardDefinition = {
  id: CardId
  name: string
  classId: CharacterId
  type: CardType
  rarity: CardRarity
  cost: number
  upgradedCost?: number
  description: string
  upgradedDescription: string
  effect: CardEffect
  upgradedEffect: CardEffect
}

export type RelicDefinition = {
  id: RelicId
  name: string
  description: string
  trigger: 'combatEnd'
  healAmount?: number
}

export type CharacterDefinition = {
  id: CharacterId
  name: string
  title: string
  maxHp: number
  startingRelicId: RelicId
  startingDeck: CardId[]
}

export type EnemyIntentDefinition = {
  label: string
  damage?: number
  block?: number
  applyVulnerable?: number
  applyWeak?: number
  gainStrength?: number
  gainRitual?: number
}

export type EnemyDefinition = {
  id: EnemyId
  name: string
  maxHp: number
  goldReward: number
  intentCycle: EnemyIntentDefinition[]
  passive?: {
    curlUpBlock?: number
    onDeathApplyVulnerable?: number
  }
}

export type EncounterDefinition = {
  id: string
  name: string
  description: string
  enemyIds: EnemyId[]
}

export type CardInstance = {
  instanceId: string
  cardId: CardId
  upgraded: boolean
}

export type EnemyState = {
  instanceId: string
  definitionId: EnemyId
  name: string
  currentHp: number
  maxHp: number
  block: number
  strength: number
  ritual: number
  vulnerable: number
  weak: number
  intentIndex: number
  curlUpUsed: boolean
  deathResolved: boolean
}

export type PlayerCombatState = {
  energy: number
  maxEnergy: number
  strength: number
  temporaryStrength: number
  block: number
  vulnerable: number
  weak: number
  retaliateDamage: number
  feelNoPainBlock: number
  darkEmbraceDraw: number
  ruptureStrength: number
  demonFormStrength: number
  juggernautDamage: number
  infernoDamage: number
  crimsonMantleBlock: number
}

export type CombatState = {
  nodeId: string
  floor: number
  turn: number
  exhaustedThisTurn: number
  attacksPlayedThisTurn: number
  player: PlayerCombatState
  hand: CardInstance[]
  drawPile: CardInstance[]
  discardPile: CardInstance[]
  exhaustPile: CardInstance[]
  enemies: EnemyState[]
}

export type MapNode = {
  id: string
  floor: number
  kind: NodeKind
  title: string
  description: string
  encounterId?: string
}

export type RewardState = {
  floor: number
  goldGained: number
  cardChoices: CardId[]
}

export type RunState = {
  characterId: CharacterId
  currentHp: number
  maxHp: number
  gold: number
  deck: CardInstance[]
  relicIds: RelicId[]
  seed: number
  rngState: number
  map: MapNode[]
  currentNodeIndex: number
}

export type LogEntry = {
  id: string
  message: string
  tone: Tone
}

export type UIState = {
  screen: Screen
  log: LogEntry[]
  pendingChoice: PendingChoice | null
}

export type PendingChoice =
  | {
      kind: 'upgrade-hand'
      sourceCardName: string
      options: CardInstance[]
    }
  | {
      kind: 'exhaust-hand'
      sourceCardName: string
      options: CardInstance[]
      drawCardsAfter?: number
    }
  | {
      kind: 'discard-to-draw'
      sourceCardName: string
      options: CardInstance[]
    }

export type GameState = {
  run: RunState | null
  combat: CombatState | null
  rewards: RewardState | null
  ui: UIState
}

export type GameAction =
  | { type: 'START_RUN' }
  | { type: 'RESTART' }
  | { type: 'ENTER_NODE'; nodeId: string }
  | { type: 'PLAY_CARD'; cardInstanceId: string; targetEnemyId?: string }
  | { type: 'RESOLVE_PENDING_CHOICE'; cardInstanceId: string }
  | { type: 'CANCEL_PENDING_CHOICE' }
  | { type: 'END_TURN' }
  | { type: 'PICK_REWARD'; cardId: CardId }
  | { type: 'SKIP_REWARD' }
  | { type: 'REST' }
  | { type: 'SHOP_HEAL' }
  | { type: 'LEAVE_NODE' }

export type ActionButton = {
  id: string
  label: string
  action: GameAction
  disabled?: boolean
  hint?: string
}

export type Panel = {
  id: string
  title: string
  lines: string[]
}

export type ViewModel = {
  title: string
  subtitle: string
  statusBadges: string[]
  panels: Panel[]
  choicePanel: Panel | null
  log: LogEntry[]
  actions: ActionButton[]
}
