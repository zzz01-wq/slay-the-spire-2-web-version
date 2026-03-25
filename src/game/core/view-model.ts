import {
  cardDefinitions,
  enemyDefinitions,
  ironcladDefinition,
  relicDefinitions,
} from '../content/index.ts'
import type {
  ActionButton,
  CardDefinition,
  CardInstance,
  CombatSummary,
  EnemyIntentDefinition,
  EnemyState,
  GameState,
  HandCardViewModel,
  InspectablePile,
  Panel,
  PlayerCombatState,
  PlayerPowerName,
  ViewModel,
} from '../types.ts'

const PLAYER_POWER_DISPLAY: Array<{
  key: PlayerPowerName
  label: string
}> = [
  { key: 'feelNoPainBlock', label: 'Feel No Pain' },
  { key: 'darkEmbraceDraw', label: 'Dark Embrace' },
  { key: 'ruptureStrength', label: 'Rupture' },
  { key: 'demonFormStrength', label: 'Demon Form' },
  { key: 'juggernautDamage', label: 'Juggernaut' },
  { key: 'infernoDamage', label: 'Inferno' },
  { key: 'crimsonMantleBlock', label: 'Crimson Mantle' },
]

export function createViewModel(state: GameState): ViewModel {
  return {
    title: getTitle(state),
    subtitle: getSubtitle(state),
    statusBadges: getStatusBadges(state),
    panels: getPanels(state),
    combatSummary: getCombatSummary(state),
    handCards: getHandCards(state),
    inspectablePiles: getInspectablePiles(state),
    choicePanel: getChoicePanel(state),
    actions: getActions(state),
  }
}

function getTitle(state: GameState): string {
  switch (state.ui.screen) {
    case 'title':
      return 'Slay the Spire 2: Text Ascent'
    case 'map':
      return 'Choose the Next Room'
    case 'combat':
      return 'Battle in Progress'
    case 'reward':
      return 'Choose Your Reward'
    case 'rest':
      return 'Campfire'
    case 'shop':
      return 'Shadow Market'
    case 'victory':
      return 'Prototype Victory'
    case 'defeat':
      return 'Run Defeated'
  }
}

function getSubtitle(state: GameState): string {
  if (!state.run) {
    return 'A text-first prototype focused on scalable game rules and clean UI layering.'
  }

  const nextFloor = Math.min(state.run.currentNodeIndex + 2, state.run.map.length)
  return `Ironclad run. Floor ${Math.max(1, nextFloor)} awaits.`
}

function getStatusBadges(state: GameState): string[] {
  if (!state.run) {
    return ['Ironclad only', 'Wiki-driven starter data', 'Single-player']
  }

  const relicNames = state.run.relicIds.map((relicId) => relicDefinitions[relicId].name)
  return [
    `${state.run.currentHp}/${state.run.maxHp} HP`,
    `${state.run.gold} gold`,
    `${state.run.deck.length} cards`,
    ...relicNames,
  ]
}

function getPanels(state: GameState): Panel[] {
  const panels: Panel[] = [createRunPanel(state)]

  if (state.ui.screen === 'map' && state.run) {
    panels.push(createMapPanel(state))
  }

  if (state.ui.screen === 'reward' && state.rewards) {
    panels.push({
      id: 'reward',
      title: 'Card Reward',
      lines: state.rewards.cardChoices.map((cardId) => {
        const card = cardDefinitions[cardId]
        return `${card.name} (${card.cost}) - ${card.description}`
      }),
    })
  }

  if (state.ui.screen === 'rest') {
    panels.push({
      id: 'rest',
      title: 'Campfire Options',
      lines: ['Rest to recover 24 HP, or leave and keep climbing.'],
    })
  }

  if (state.ui.screen === 'shop') {
    panels.push({
      id: 'shop',
      title: 'Merchant Offer',
      lines: ['Buy a restorative draught for 25 gold and recover 18 HP, or leave.'],
    })
  }

  if (state.ui.screen === 'victory' || state.ui.screen === 'defeat') {
    panels.push({
      id: 'result',
      title: 'Run Summary',
      lines: [
        state.run
          ? `Floors cleared: ${state.run.currentNodeIndex + 1}/${state.run.map.length}`
          : 'No active run.',
        state.run ? `Final deck size: ${state.run.deck.length}` : '',
      ].filter(Boolean),
    })
  }

  return panels
}

function createRunPanel(state: GameState): Panel {
  if (!state.run) {
    return {
      id: 'run',
      title: 'Run Status',
      lines: [
        ironcladDefinition.name,
        ironcladDefinition.title,
        `Starting relic: ${relicDefinitions[ironcladDefinition.startingRelicId].name}`,
      ],
    }
  }

  const nextNode = state.run.map[state.run.currentNodeIndex + 1]
  return {
    id: 'run',
    title: 'Run Status',
    lines: [
      `${ironcladDefinition.name} | HP ${state.run.currentHp}/${state.run.maxHp} | Gold ${state.run.gold}`,
      `Deck ${state.run.deck.length} cards | Relic ${state.run.relicIds.map((relicId) => relicDefinitions[relicId].name).join(', ')}`,
      nextNode
        ? `Next room: Floor ${nextNode.floor} ${nextNode.title} (${nextNode.kind})`
        : 'No more rooms remain in this prototype path.',
    ],
  }
}

function createMapPanel(state: GameState): Panel {
  const run = state.run!
  return {
    id: 'map',
    title: 'Route',
    lines: run.map.map((node, index) => {
      const marker =
        index < run.currentNodeIndex + 1
          ? '[cleared]'
          : index === run.currentNodeIndex + 1
            ? '[next]'
            : '[ahead]'
      return `${marker} Floor ${node.floor}: ${node.title} - ${node.description}`
    }),
  }
}

function getInspectablePiles(state: GameState): InspectablePile[] {
  if (state.ui.screen !== 'combat' || !state.combat) {
    return []
  }

  return [
    createInspectablePile('draw', 'Draw Pile', state.combat.drawPile, true),
    createInspectablePile('discard', 'Discard Pile', state.combat.discardPile, false),
    createInspectablePile('exhaust', 'Exhaust Pile', state.combat.exhaustPile, false),
  ]
}

function createInspectablePile(
  id: InspectablePile['id'],
  title: string,
  cards: CardInstance[],
  keepOrder: boolean,
): InspectablePile {
  const orderedCards = keepOrder ? [...cards] : [...cards].reverse()

  return {
    id,
    title,
    count: cards.length,
    summary: cards.length > 0 ? orderedCards[0] ? `Top: ${formatCardLabel(orderedCards[0])}` : 'No cards.' : 'No cards.',
    lines: cards.length > 0 ? orderedCards.map((card) => formatCardLabel(card)) : ['No cards.'],
  }
}

function getHandCards(state: GameState): HandCardViewModel[] {
  if (state.ui.screen !== 'combat' || !state.combat) {
    return []
  }

  return state.combat.hand.map((card) => {
    const definition = cardDefinitions[card.cardId]
    const cost = getDisplayedCost(card)
    const disabled = cost > state.combat!.player.energy
    const targets = needsEnemyTarget(definition)
      ? state.combat!.enemies
          .filter((enemy) => enemy.currentHp > 0)
          .map((enemy) => ({
            enemyId: enemy.instanceId,
            enemyName: enemy.name,
          }))
      : []

    return {
      instanceId: card.instanceId,
      name: `${definition.name}${card.upgraded ? '+' : ''}`,
      cost,
      description: card.upgraded ? definition.upgradedDescription : definition.description,
      disabled,
      disabledReason: disabled ? 'Not enough energy.' : undefined,
      targetMode: definition.effect.randomTarget
        ? 'random'
        : definition.effect.damageAll !== undefined
          ? 'all'
          : needsEnemyTarget(definition)
            ? 'enemy'
            : 'none',
      targets,
    }
  })
}

function getCombatSummary(state: GameState): CombatSummary | null {
  if (state.ui.screen !== 'combat' || !state.combat) {
    return null
  }

  const combat = state.combat
  const activePowers = getActivePlayerPowerText(combat.player)

  return {
    turn: combat.turn,
    playerStats: [
      { key: 'energy', label: 'Energy', value: `${combat.player.energy}/${combat.player.maxEnergy}` },
      { key: 'strength', label: 'Strength', value: combat.player.strength + combat.player.temporaryStrength },
      { key: 'block', label: 'Block', value: combat.player.block },
      { key: 'vulnerable', label: 'Vulnerable', value: combat.player.vulnerable },
      { key: 'weak', label: 'Weak', value: combat.player.weak },
      { key: 'exhausted', label: 'Exhausted', value: combat.exhaustedThisTurn },
    ],
    powersText: activePowers,
    enemies: combat.enemies.map((enemy) => ({
      id: enemy.instanceId,
      name: enemy.name,
      currentHp: enemy.currentHp,
      maxHp: enemy.maxHp,
      intent: enemy.currentHp > 0 ? formatEnemyIntent(enemy) : 'Defeated',
      stats: [
        { key: 'block', label: 'Block', value: enemy.block },
        { key: 'strength', label: 'Strength', value: enemy.strength },
        { key: 'ritual', label: 'Ritual', value: enemy.ritual },
        { key: 'vulnerable', label: 'Vulnerable', value: enemy.vulnerable },
        { key: 'weak', label: 'Weak', value: enemy.weak },
      ],
    })),
  }
}

function getActions(state: GameState): ActionButton[] {
  if (state.ui.pendingChoice) {
    return getPendingChoiceActions(state)
  }

  switch (state.ui.screen) {
    case 'title':
      return [{ id: 'start', label: 'Start Ironclad Run', action: { type: 'START_RUN' } }]
    case 'map':
      return getMapActions(state)
    case 'combat':
      return getCombatActions(state)
    case 'reward':
      return getRewardActions(state)
    case 'rest':
      return [
        { id: 'rest', label: 'Rest for 24 HP', action: { type: 'REST' } },
        { id: 'leave-rest', label: 'Leave Campfire', action: { type: 'LEAVE_NODE' } },
      ]
    case 'shop':
      return [
        { id: 'shop-heal', label: 'Buy Heal for 25 Gold', action: { type: 'SHOP_HEAL' } },
        { id: 'leave-shop', label: 'Leave Merchant', action: { type: 'LEAVE_NODE' } },
      ]
    case 'victory':
    case 'defeat':
      return [{ id: 'restart', label: 'Return to Title', action: { type: 'RESTART' } }]
  }
}

function getPendingChoiceActions(state: GameState): ActionButton[] {
  const choice = state.ui.pendingChoice
  if (!choice) {
    return []
  }

  return [
    ...choice.options.map((card) => ({
      id: `choice-${card.instanceId}`,
      label:
        choice.kind === 'upgrade-hand'
          ? `Upgrade ${formatCardLabel(card)}`
          : choice.kind === 'discard-to-draw'
            ? `Take ${formatCardLabel(card)}`
            : `Exhaust ${formatCardLabel(card)}`,
      action: { type: 'RESOLVE_PENDING_CHOICE' as const, cardInstanceId: card.instanceId },
    })),
    {
      id: 'cancel-choice',
      label: 'Skip Follow-up Choice',
      action: { type: 'CANCEL_PENDING_CHOICE' },
    },
  ]
}

function getChoicePanel(state: GameState): Panel | null {
  const choice = state.ui.pendingChoice
  if (!choice) {
    return null
  }

  return {
    id: 'choice',
    title:
      choice.kind === 'upgrade-hand'
        ? 'Choose a Hand Card'
        : choice.kind === 'discard-to-draw'
          ? 'Choose a Discard Card'
          : 'Choose a Card to Exhaust',
    lines: [
      choice.kind === 'upgrade-hand'
        ? `${choice.sourceCardName}: choose a card in your hand to upgrade for this combat.`
        : choice.kind === 'discard-to-draw'
          ? `${choice.sourceCardName}: choose a card from your discard pile to place on top of your draw pile.`
          : `${choice.sourceCardName}: choose a card in your hand to exhaust.`,
      ...choice.options.map((card) => formatCardLabel(card)),
    ],
  }
}

function getMapActions(state: GameState): ActionButton[] {
  if (!state.run) {
    return []
  }

  const nextNode = state.run.map[state.run.currentNodeIndex + 1]
  if (!nextNode) {
    return [{ id: 'restart', label: 'Return to Title', action: { type: 'RESTART' } }]
  }

  return [
    {
      id: nextNode.id,
      label: `Enter Floor ${nextNode.floor}: ${nextNode.title}`,
      action: { type: 'ENTER_NODE', nodeId: nextNode.id },
    },
  ]
}

function getCombatActions(state: GameState): ActionButton[] {
  if (!state.combat) {
    return []
  }
  return [{ id: 'end-turn', label: 'End Turn', action: { type: 'END_TURN' } }]
}

function getRewardActions(state: GameState): ActionButton[] {
  if (!state.rewards) {
    return []
  }

  return [
    ...state.rewards.cardChoices.map((cardId) => ({
      id: cardId,
      label: `Take ${cardDefinitions[cardId].name}`,
      action: { type: 'PICK_REWARD' as const, cardId },
    })),
    { id: 'skip-reward', label: 'Skip Reward', action: { type: 'SKIP_REWARD' } },
  ]
}

function needsEnemyTarget(definition: CardDefinition): boolean {
  if (definition.effect.targetEnemy) {
    return true
  }

  return definition.type === 'attack' && !definition.effect.randomTarget
    && definition.effect.damageAll === undefined
}

function getActivePlayerPowerText(player: PlayerCombatState): string {
  const activePowers = PLAYER_POWER_DISPLAY
    .filter(({ key }) => player[key] > 0)
    .map(({ key, label }) => `${label} ${player[key]}`)

  return activePowers.length > 0 ? `Powers: ${activePowers.join(', ')}` : ''
}

function formatEnemyIntent(enemy: EnemyState): string {
  const intent = enemyDefinitions[enemy.definitionId].intentCycle[enemy.intentIndex]
  if (!intent) {
    return 'Unknown'
  }

  const actionLabel = intent.label.split(':')[0].split(' for ')[0]
  const followUps: string[] = []
  if (intent.block) {
    followUps.push(`gain ${intent.block} Block`)
  }

  if (intent.applyVulnerable) {
    followUps.push(`apply ${intent.applyVulnerable} Vulnerable`)
  }

  if (intent.applyWeak) {
    followUps.push(`apply ${intent.applyWeak} Weak`)
  }

  if (intent.gainStrength) {
    followUps.push(`gain ${intent.gainStrength} Strength`)
  }

  if (intent.gainRitual) {
    followUps.push(`gain ${intent.gainRitual} Ritual`)
  }

  const lead =
    intent.damage !== undefined
      ? `${actionLabel} for ${getEnemyIntentDamage(enemy, intent)}`
      : actionLabel

  return followUps.length > 0 ? `${lead}; ${followUps.join(', ')}` : lead
}

function getEnemyIntentDamage(enemy: EnemyState, intent: EnemyIntentDefinition): number {
  if (intent.damage === undefined) {
    return 0
  }

  let damage = intent.damage + enemy.strength
  if (enemy.weak > 0) {
    damage = Math.max(0, Math.floor(damage * 0.75))
  }

  return damage
}

function formatCardLabel(card: CardInstance): string {
  const definition = cardDefinitions[card.cardId]
  return `${definition.name}${card.upgraded ? '+' : ''} (${getDisplayedCost(card)}) - ${
    card.upgraded ? definition.upgradedDescription : definition.description
  }`
}

function getDisplayedCost(card: CardInstance): number {
  const definition = cardDefinitions[card.cardId]
  if (card.upgraded && definition.upgradedCost !== undefined) {
    return definition.upgradedCost
  }
  return definition.cost
}
