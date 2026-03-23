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
  EnemyIntentDefinition,
  EnemyState,
  GameState,
  InspectablePile,
  Panel,
  PlayerCombatState,
  PlayerPowerName,
  ViewModel,
} from '../types.ts'

const MAX_ACTIONS = 9

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
    inspectablePiles: getInspectablePiles(state),
    choicePanel: getChoicePanel(state),
    log: [...state.ui.log].reverse(),
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

  if (state.ui.screen === 'combat' && state.run && state.combat) {
    panels.push(createCombatPanel(state))
    panels.push(createHandPanel(state.combat.hand, state.combat.player.energy))
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

function createCombatPanel(state: GameState): Panel {
  const combat = state.combat!
  const activePowers = getActivePlayerPowerText(combat.player)
  return {
    id: 'combat',
    title: `Combat Turn ${combat.turn}`,
    lines: [
      `Energy ${combat.player.energy}/${combat.player.maxEnergy} | Strength ${combat.player.strength + combat.player.temporaryStrength} | Block ${combat.player.block} | Vulnerable ${combat.player.vulnerable} | Weak ${combat.player.weak} | Exhausted this turn ${combat.exhaustedThisTurn}`,
      activePowers,
      ...combat.enemies.map((enemy) => {
        const intent = enemy.currentHp > 0 ? formatEnemyIntent(enemy) : 'Defeated'
        return `${enemy.name}: HP ${enemy.currentHp}/${enemy.maxHp}, Block ${enemy.block}, Strength ${enemy.strength}, Ritual ${enemy.ritual}, Vulnerable ${enemy.vulnerable}, Weak ${enemy.weak}, Intent ${intent}`
      }),
      `Draw ${combat.drawPile.length} | Discard ${combat.discardPile.length} | Exhaust ${combat.exhaustPile.length}`,
    ].filter(Boolean),
  }
}

function createHandPanel(hand: CardInstance[], energy: number): Panel {
  return {
    id: 'hand',
    title: 'Hand',
    lines:
      hand.length > 0
        ? hand.map((card) => {
            const locked = getDisplayedCost(card) > energy ? ' [not enough energy]' : ''
            return `${formatCardLabel(card)}${locked}`
          })
        : ['Your hand is empty. End the turn to continue.'],
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

  const actions: ActionButton[] = []

  for (const card of state.combat.hand.slice(0, MAX_ACTIONS)) {
    const definition = cardDefinitions[card.cardId]
    const disabled = getDisplayedCost(card) > state.combat.player.energy

    if (needsEnemyTarget(definition)) {
      for (const enemy of state.combat.enemies.filter((target) => target.currentHp > 0)) {
        actions.push({
          id: `${card.instanceId}-${enemy.instanceId}`,
          label: `Play ${definition.name} on ${enemy.name}`,
          action: {
            type: 'PLAY_CARD',
            cardInstanceId: card.instanceId,
            targetEnemyId: enemy.instanceId,
          },
          disabled,
        })
      }
      continue
    }

    actions.push({
      id: card.instanceId,
      label: actionLabelForCard(definition),
      action: { type: 'PLAY_CARD', cardInstanceId: card.instanceId },
      disabled,
    })
  }

  actions.push({ id: 'end-turn', label: 'End Turn', action: { type: 'END_TURN' } })
  return actions
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

function actionLabelForCard(definition: CardDefinition): string {
  if (definition.effect.randomTarget) {
    return `Play ${definition.name} (random target)`
  }

  if (definition.effect.damageAll !== undefined) {
    return `Play ${definition.name} (all enemies)`
  }

  return `Play ${definition.name}`
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
