import {
  cardDefinitions,
  encounterDefinitions,
  enemyDefinitions,
  ironcladDefinition,
  relicDefinitions,
  rewardCardPool,
} from '../content/index.ts'
import { randomIndex, shuffleWithSeed } from './rng.ts'
import type {
  CardDefinition,
  CardEffect,
  CardId,
  CardInstance,
  CombatState,
  EncounterDefinition,
  EnemyId,
  EnemyState,
  GameAction,
  GameState,
  LogEntry,
  MapNode,
  PendingChoice,
  RewardState,
  RunState,
  Tone,
} from '../types.ts'

const MAX_LOG_ENTRIES = 16
const DRAW_PER_TURN = 5

let cardSequence = 0
let logSequence = 0

export function createInitialGameState(): GameState {
  return {
    run: null,
    combat: null,
    rewards: null,
    ui: {
      screen: 'title',
      log: [createLogEntry('The Spire waits. Start a run to begin.', 'neutral')],
      pendingChoice: null,
    },
  }
}

export function reduceGameState(
  state: GameState,
  action: GameAction,
): GameState {
  switch (action.type) {
    case 'START_RUN':
      return startRun()
    case 'RESTART':
      return createInitialGameState()
    case 'ENTER_NODE':
      return enterNode(state, action.nodeId)
    case 'PLAY_CARD':
      return playCard(state, action.cardInstanceId, action.targetEnemyId)
    case 'RESOLVE_PENDING_CHOICE':
      return resolvePendingChoice(state, action.cardInstanceId)
    case 'CANCEL_PENDING_CHOICE':
      return cancelPendingChoice(state)
    case 'END_TURN':
      return endTurn(state)
    case 'PICK_REWARD':
      return pickReward(state, action.cardId)
    case 'SKIP_REWARD':
      return leaveReward(state)
    case 'REST':
      return restAtCampfire(state)
    case 'SHOP_HEAL':
      return shopHeal(state)
    case 'LEAVE_NODE':
      return leaveNode(state)
    default:
      return state
  }
}

function startRun(): GameState {
  const seed = Date.now() >>> 0
  const run = createRunState(seed)
  return {
    run,
    combat: null,
    rewards: null,
    ui: {
      screen: 'map',
      pendingChoice: null,
      log: appendLogs([], [
        createLogEntry("You take up the Ironclad's blade.", 'good'),
        createLogEntry('The opening path through the Spire has appeared.', 'neutral'),
      ]),
    },
  }
}

function enterNode(state: GameState, nodeId: string): GameState {
  if (!state.run || state.ui.screen !== 'map') {
    return state
  }

  const nextNode = getNextNode(state.run)
  if (!nextNode || nextNode.id !== nodeId) {
    return state
  }

  if (nextNode.kind === 'combat') {
    return startCombat(state, nextNode)
  }

  if (nextNode.kind === 'rest') {
    return {
      ...state,
      run: {
        ...state.run,
        currentNodeIndex: nextNode.floor - 1,
      },
      ui: {
        screen: 'rest',
        pendingChoice: null,
        log: appendLogs(state.ui.log, [
          createLogEntry(`Floor ${nextNode.floor}: ${nextNode.title}.`, 'neutral'),
          createLogEntry(
            'A small campfire burns here. You can rest before pushing onward.',
            'neutral',
          ),
        ]),
      },
    }
  }

  return {
    ...state,
    run: {
      ...state.run,
      currentNodeIndex: nextNode.floor - 1,
    },
    ui: {
      screen: 'shop',
      pendingChoice: null,
      log: appendLogs(state.ui.log, [
        createLogEntry(`Floor ${nextNode.floor}: ${nextNode.title}.`, 'neutral'),
        createLogEntry(
          'A shadow merchant offers one simple service for now: recover HP for gold.',
          'neutral',
        ),
      ]),
    },
  }
}

function playCard(
  state: GameState,
  cardInstanceId: string,
  targetEnemyId?: string,
): GameState {
  if (
    !state.run ||
    !state.combat ||
    state.ui.screen !== 'combat' ||
    state.ui.pendingChoice
  ) {
    return state
  }

  const run = { ...state.run }
  const combat = cloneCombat(state.combat)
  const handIndex = combat.hand.findIndex((card) => card.instanceId === cardInstanceId)
  if (handIndex < 0) {
    return state
  }

  const card = combat.hand[handIndex]
  const definition = cardDefinitions[card.cardId]
  const energyCost = getCardCost(card)
  if (combat.player.energy < energyCost) {
    return appendStateLogs(state, [
      createLogEntry(`Not enough energy to play ${definition.name}.`, 'bad'),
    ])
  }

  const target = pickTarget(combat, definition, targetEnemyId)
  if (definition.type === 'attack' && needsTarget(definition) && !target) {
    return appendStateLogs(state, [
      createLogEntry(`${definition.name} needs a living target.`, 'bad'),
    ])
  }

  combat.player.energy -= energyCost
  combat.hand.splice(handIndex, 1)

  const logs: LogEntry[] = [createLogEntry(`You play ${definition.name}.`, 'neutral')]
  const effect = card.upgraded ? definition.upgradedEffect : definition.effect
  const pendingChoice = resolveCardEffect(run, combat, card, definition, effect, target, logs)

  if (effect.exhaustSelf) {
    moveCardToExhaust(combat, card)
    logs.push(createLogEntry(`${definition.name} is exhausted.`, 'neutral'))
  } else {
    combat.discardPile.push(card)
  }

  if (run.currentHp <= 0) {
    return {
      ...state,
      run: {
        ...run,
        currentHp: 0,
      },
      combat,
      ui: {
        screen: 'defeat',
        pendingChoice: null,
        log: appendLogs(state.ui.log, [
          ...logs,
          createLogEntry('The Ironclad collapses under the strain.', 'bad'),
        ]),
      },
    }
  }

  const nextState: GameState = {
    ...state,
    run,
    combat,
    ui: {
      screen: 'combat',
      pendingChoice,
      log: appendLogs(state.ui.log, logs),
    },
  }

  return pendingChoice ? nextState : finishCombatIfNeeded(nextState)
}

function resolvePendingChoice(state: GameState, cardInstanceId: string): GameState {
  if (
    !state.run ||
    !state.combat ||
    state.ui.screen !== 'combat' ||
    !state.ui.pendingChoice
  ) {
    return state
  }

  const run = { ...state.run }
  const combat = cloneCombat(state.combat)
  const choice = state.ui.pendingChoice
  const logs: LogEntry[] = []

  if (choice.kind === 'upgrade-hand') {
    const selected = combat.hand.find((card) => card.instanceId === cardInstanceId)
    if (!selected) {
      return state
    }

    selected.upgraded = true
    logs.push(
      createLogEntry(
        `${cardDefinitions[selected.cardId].name} is upgraded for this combat.`,
        'good',
      ),
    )
  }

  if (choice.kind === 'discard-to-draw') {
    const index = combat.discardPile.findIndex((card) => card.instanceId === cardInstanceId)
    if (index < 0) {
      return state
    }

    const [selected] = combat.discardPile.splice(index, 1)
    combat.drawPile.unshift(selected)
    logs.push(
      createLogEntry(
        `${cardDefinitions[selected.cardId].name} is placed on top of your draw pile.`,
        'good',
      ),
    )
  }

  if (choice.kind === 'exhaust-hand') {
    const index = combat.hand.findIndex((card) => card.instanceId === cardInstanceId)
    if (index < 0) {
      return state
    }

    const [selected] = combat.hand.splice(index, 1)
    moveCardToExhaust(combat, selected)
    logs.push(
      createLogEntry(`${cardDefinitions[selected.cardId].name} is exhausted.`, 'neutral'),
    )

    if (choice.drawCardsAfter) {
      const drawResult = drawCards(run, combat, choice.drawCardsAfter)
      run.rngState = drawResult.run.rngState
      logs.push(
        createLogEntry(
          `You draw ${drawResult.drawn} card${drawResult.drawn > 1 ? 's' : ''}.`,
          'good',
        ),
      )
    }
  }

  const nextState: GameState = {
    ...state,
    run,
    combat,
    ui: {
      screen: 'combat',
      pendingChoice: null,
      log: appendLogs(state.ui.log, logs),
    },
  }

  return finishCombatIfNeeded(nextState)
}

function cancelPendingChoice(state: GameState): GameState {
  if (!state.ui.pendingChoice) {
    return state
  }

  return {
    ...state,
    ui: {
      ...state.ui,
      pendingChoice: null,
      log: appendLogs(state.ui.log, [
        createLogEntry('You skip the follow-up choice.', 'neutral'),
      ]),
    },
  }
}

function endTurn(state: GameState): GameState {
  if (
    !state.run ||
    !state.combat ||
    state.ui.screen !== 'combat' ||
    state.ui.pendingChoice
  ) {
    return state
  }

  const run = { ...state.run }
  const combat = cloneCombat(state.combat)
  const logs: LogEntry[] = [createLogEntry('You end your turn.', 'neutral')]

  combat.discardPile.push(...combat.hand)
  combat.hand = []
  combat.player.temporaryStrength = 0
  combat.player.weak = tickDown(combat.player.weak)
  combat.player.vulnerable = tickDown(combat.player.vulnerable)
  combat.exhaustedThisTurn = 0

  for (const enemy of combat.enemies) {
    if (enemy.currentHp <= 0) {
      continue
    }

    enemy.block = 0
    const intent = getCurrentIntent(enemy)

    if (intent.block) {
      enemy.block += intent.block
      logs.push(createLogEntry(`${enemy.name} gains ${intent.block} Block.`, 'neutral'))
    }

    if (intent.gainStrength) {
      enemy.strength += intent.gainStrength
      logs.push(
        createLogEntry(`${enemy.name} gains ${intent.gainStrength} Strength.`, 'bad'),
      )
    }

    if (intent.gainRitual) {
      enemy.ritual += intent.gainRitual
      logs.push(
        createLogEntry(`${enemy.name} gains ${intent.gainRitual} Ritual.`, 'bad'),
      )
    }

    if (intent.damage) {
      const dealt = dealDamageToPlayer(run, combat, enemy, intent.damage)
      logs.push(
        createLogEntry(
          `${enemy.name} attacks for ${dealt} damage.`,
          dealt > 0 ? 'bad' : 'neutral',
        ),
      )

      if (enemy.currentHp > 0 && combat.player.retaliateDamage > 0) {
        const reflected = dealDamageToEnemy(enemy, combat.player.retaliateDamage)
        logs.push(
          createLogEntry(
            `Flame Barrier hits ${enemy.name} for ${reflected} damage.`,
            reflected > 0 ? 'good' : 'neutral',
          ),
        )
        resolveEnemyAfterHit(combat, enemy, logs)
      }
    }

    if (intent.applyVulnerable) {
      combat.player.vulnerable += intent.applyVulnerable
      logs.push(
        createLogEntry(
          `${enemy.name} applies ${intent.applyVulnerable} Vulnerable.`,
          'bad',
        ),
      )
    }

    if (intent.applyWeak) {
      combat.player.weak += intent.applyWeak
      logs.push(
        createLogEntry(`${enemy.name} applies ${intent.applyWeak} Weak.`, 'bad'),
      )
    }

    if (enemy.ritual > 0) {
      enemy.strength += enemy.ritual
      logs.push(
        createLogEntry(
          `${enemy.name}'s Ritual grants ${enemy.ritual} Strength.`,
          'bad',
        ),
      )
    }

    enemy.vulnerable = tickDown(enemy.vulnerable)
    enemy.weak = tickDown(enemy.weak)
    enemy.intentIndex =
      (enemy.intentIndex + 1) %
      enemyDefinitions[enemy.definitionId].intentCycle.length
  }

  combat.player.retaliateDamage = 0

  if (run.currentHp <= 0) {
    return {
      ...state,
      run: {
        ...run,
        currentHp: 0,
      },
      combat,
      ui: {
        screen: 'defeat',
        pendingChoice: null,
        log: appendLogs(state.ui.log, [
          ...logs,
          createLogEntry('The Ironclad falls before the Spire.', 'bad'),
        ]),
      },
    }
  }

  combat.turn += 1
  combat.player.block = 0
  combat.player.energy = combat.player.maxEnergy

  const drawResult = drawCards(run, combat, DRAW_PER_TURN)
  logs.push(createLogEntry(`Turn ${combat.turn} begins.`, 'neutral'))
  if (drawResult.drawn > 0) {
    logs.push(
      createLogEntry(
        `You draw ${drawResult.drawn} card${drawResult.drawn > 1 ? 's' : ''}.`,
        'neutral',
      ),
    )
  }

  return {
    ...state,
    run: drawResult.run,
    combat,
    ui: {
      screen: 'combat',
      pendingChoice: null,
      log: appendLogs(state.ui.log, logs),
    },
  }
}

function pickReward(state: GameState, cardId: CardId): GameState {
  if (!state.run || !state.rewards || state.ui.screen !== 'reward') {
    return state
  }

  if (!state.rewards.cardChoices.includes(cardId)) {
    return state
  }

  const nextCard = createCardInstance(cardId, state.run.deck.length + 1)
  const run: RunState = {
    ...state.run,
    deck: [...state.run.deck, nextCard],
  }

  const cardName = cardDefinitions[cardId].name
  const nextState: GameState = {
    ...state,
    run,
    rewards: null,
    ui: {
      screen: 'map',
      pendingChoice: null,
      log: appendLogs(state.ui.log, [
        createLogEntry(`${cardName} joins your deck.`, 'good'),
      ]),
    },
  }

  return advanceAfterNode(nextState)
}

function leaveReward(state: GameState): GameState {
  if (!state.run || !state.rewards || state.ui.screen !== 'reward') {
    return state
  }

  return advanceAfterNode({
    ...state,
    rewards: null,
    ui: {
      screen: 'map',
      pendingChoice: null,
      log: appendLogs(state.ui.log, [
        createLogEntry('You skip the card reward and keep climbing.', 'neutral'),
      ]),
    },
  })
}

function restAtCampfire(state: GameState): GameState {
  if (!state.run || state.ui.screen !== 'rest') {
    return state
  }

  const healed = Math.min(24, state.run.maxHp - state.run.currentHp)
  const run = {
    ...state.run,
    currentHp: Math.min(state.run.maxHp, state.run.currentHp + 24),
  }

  return advanceAfterNode({
    ...state,
    run,
    ui: {
      screen: 'map',
      pendingChoice: null,
      log: appendLogs(state.ui.log, [
        createLogEntry(`You rest by the fire and recover ${healed} HP.`, 'good'),
      ]),
    },
  })
}

function shopHeal(state: GameState): GameState {
  if (!state.run || state.ui.screen !== 'shop') {
    return state
  }

  const cost = 25
  if (state.run.gold < cost) {
    return appendStateLogs(state, [
      createLogEntry(`You need ${cost} gold to buy a restorative draught.`, 'bad'),
    ])
  }

  const healed = Math.min(18, state.run.maxHp - state.run.currentHp)
  const run = {
    ...state.run,
    gold: state.run.gold - cost,
    currentHp: Math.min(state.run.maxHp, state.run.currentHp + 18),
  }

  return advanceAfterNode({
    ...state,
    run,
    ui: {
      screen: 'map',
      pendingChoice: null,
      log: appendLogs(state.ui.log, [
        createLogEntry(
          `You spend ${cost} gold and recover ${healed} HP.`,
          healed > 0 ? 'good' : 'neutral',
        ),
      ]),
    },
  })
}

function leaveNode(state: GameState): GameState {
  if (state.ui.screen !== 'rest' && state.ui.screen !== 'shop') {
    return state
  }

  return advanceAfterNode({
    ...state,
    ui: {
      screen: 'map',
      pendingChoice: null,
      log: appendLogs(state.ui.log, [
        createLogEntry('You move on without lingering.', 'neutral'),
      ]),
    },
  })
}

function startCombat(state: GameState, node: MapNode): GameState {
  if (!state.run) {
    return state
  }

  const encounter = getEncounter(node)
  const combat: CombatState = {
    nodeId: node.id,
    floor: node.floor,
    turn: 1,
    exhaustedThisTurn: 0,
    player: {
      energy: 3,
      maxEnergy: 3,
      strength: 0,
      temporaryStrength: 0,
      block: 0,
      vulnerable: 0,
      weak: 0,
      retaliateDamage: 0,
      feelNoPainBlock: 0,
    },
    hand: [],
    drawPile: [],
    discardPile: [],
    exhaustPile: [],
    enemies: encounter.enemyIds.map((enemyId, index) =>
      createEnemyState(enemyId, node.floor, index),
    ),
  }

  const prepared = setupCombatDeck(state.run, combat)

  return {
    ...state,
    run: {
      ...prepared.run,
      currentNodeIndex: node.floor - 1,
    },
    combat: prepared.combat,
    rewards: null,
    ui: {
      screen: 'combat',
      pendingChoice: null,
      log: appendLogs(state.ui.log, [
        createLogEntry(`Floor ${node.floor}: ${node.title}.`, 'neutral'),
        createLogEntry(encounter.description, 'bad'),
        createLogEntry('Turn 1 begins.', 'neutral'),
        createLogEntry(`You draw ${prepared.drawn} cards.`, 'neutral'),
      ]),
    },
  }
}

function finishCombatIfNeeded(state: GameState): GameState {
  if (!state.run || !state.combat) {
    return state
  }

  if (state.combat.enemies.some((enemy) => enemy.currentHp > 0)) {
    return state
  }

  const rewardResult = createRewardState(state.run)
  const goldReward = state.combat.enemies.reduce(
    (total, enemy) => total + enemyDefinitions[enemy.definitionId].goldReward,
    0,
  )

  let run = {
    ...rewardResult.run,
    gold: state.run.gold + goldReward,
  }

  const logs: LogEntry[] = [
    createLogEntry(`You win the battle and gain ${goldReward} gold.`, 'good'),
  ]

  for (const relicId of run.relicIds) {
    const relic = relicDefinitions[relicId]
    if (relic.trigger === 'combatEnd' && relic.healAmount) {
      const healed = Math.min(relic.healAmount, run.maxHp - run.currentHp)
      run = {
        ...run,
        currentHp: Math.min(run.maxHp, run.currentHp + relic.healAmount),
      }
      logs.push(
        createLogEntry(
          `${relic.name} restores ${healed} HP.`,
          healed > 0 ? 'good' : 'neutral',
        ),
      )
    }
  }

  return {
    ...state,
    run,
    combat: null,
    rewards: rewardResult.reward,
    ui: {
      screen: 'reward',
      pendingChoice: null,
      log: appendLogs(state.ui.log, logs),
    },
  }
}

function advanceAfterNode(state: GameState): GameState {
  if (!state.run) {
    return state
  }

  if (state.run.currentNodeIndex >= state.run.map.length - 1) {
    return {
      ...state,
      ui: {
        screen: 'victory',
        pendingChoice: null,
        log: appendLogs(state.ui.log, [
          createLogEntry(
            'This prototype ascent is complete. The next tier of the Spire awaits.',
            'good',
          ),
        ]),
      },
    }
  }

  return {
    ...state,
    ui: {
      screen: 'map',
      pendingChoice: null,
      log: appendLogs(state.ui.log, [
        createLogEntry('A new route opens ahead.', 'neutral'),
      ]),
    },
  }
}

function createRunState(seed: number): RunState {
  return {
    characterId: ironcladDefinition.id,
    currentHp: ironcladDefinition.maxHp,
    maxHp: ironcladDefinition.maxHp,
    gold: 99,
    deck: ironcladDefinition.startingDeck.map((cardId, index) =>
      createCardInstance(cardId, index),
    ),
    relicIds: [ironcladDefinition.startingRelicId],
    seed,
    rngState: seed,
    map: buildMap(),
    currentNodeIndex: -1,
  }
}

function buildMap(): MapNode[] {
  const nodes: Array<Omit<MapNode, 'id' | 'floor'>> = [
    {
      kind: 'combat',
      title: 'Dusty Chapel',
      description: 'A chanting shape stands alone ahead.',
      encounterId: 'solo-cultist',
    },
    {
      kind: 'combat',
      title: 'Broken Causeway',
      description: 'Small predators swarm across the path.',
      encounterId: 'louse-pack',
    },
    {
      kind: 'rest',
      title: 'Old Campfire',
      description: 'A moment of shelter inside the Spire.',
    },
    {
      kind: 'combat',
      title: 'Gnashing Passage',
      description: 'Something heavy scrapes against the stone.',
      encounterId: 'jaw-worm',
    },
    {
      kind: 'shop',
      title: 'Shadow Market',
      description: 'A traveling merchant waits in the dark.',
    },
    {
      kind: 'combat',
      title: 'Cinder Gate',
      description: 'A final mixed patrol guards this prototype ascent.',
      encounterId: 'fungi-cult',
    },
  ]

  return nodes.map((node, index) => ({
    ...node,
    id: `floor-${index + 1}`,
    floor: index + 1,
  }))
}

function createRewardState(run: RunState): { run: RunState; reward: RewardState } {
  let rngState = run.rngState
  const available = [...rewardCardPool]
  const cardChoices: CardId[] = []

  while (available.length > 0 && cardChoices.length < 3) {
    const roll = randomIndex(rngState, available.length)
    rngState = roll.next
    cardChoices.push(available.splice(roll.index, 1)[0])
  }

  return {
    run: {
      ...run,
      rngState,
    },
    reward: {
      floor: run.currentNodeIndex + 1,
      goldGained: 0,
      cardChoices,
    },
  }
}

function setupCombatDeck(
  run: RunState,
  combat: CombatState,
): { run: RunState; combat: CombatState; drawn: number } {
  const deckForCombat = run.deck.map(cloneCardInstance)
  const { result, next } = shuffleWithSeed(deckForCombat, run.rngState)
  const nextRun = { ...run, rngState: next }
  const nextCombat = cloneCombat(combat)
  nextCombat.drawPile = result
  const drawResult = drawCards(nextRun, nextCombat, DRAW_PER_TURN)
  return {
    run: drawResult.run,
    combat: drawResult.combat,
    drawn: drawResult.drawn,
  }
}

function resolveCardEffect(
  run: RunState,
  combat: CombatState,
  card: CardInstance,
  definition: CardDefinition,
  effect: CardEffect,
  target: EnemyState | undefined,
  logs: LogEntry[],
): PendingChoice | null {
  let pendingChoice: PendingChoice | null = null
  let fatalDamageResolved = false

  if (effect.loseHpSelf) {
    run.currentHp = Math.max(0, run.currentHp - effect.loseHpSelf)
    logs.push(createLogEntry(`You lose ${effect.loseHpSelf} HP.`, 'bad'))
  }

  if (effect.gainEnergy) {
    combat.player.energy += effect.gainEnergy
    logs.push(createLogEntry(`You gain ${effect.gainEnergy} Energy.`, 'good'))
  }

  if (effect.gainEnergyPerAttackInHand) {
    const attacksInHand = combat.hand.filter(
      (handCard) => cardDefinitions[handCard.cardId].type === 'attack',
    ).length
    const gained = attacksInHand * effect.gainEnergyPerAttackInHand
    combat.player.energy += gained
    logs.push(createLogEntry(`You gain ${gained} Energy.`, gained > 0 ? 'good' : 'neutral'))
  }

  if (effect.block) {
    combat.player.block += effect.block
    logs.push(createLogEntry(`You gain ${effect.block} Block.`, 'good'))
  }

  if (effect.doubleBlock) {
    combat.player.block *= 2
    logs.push(createLogEntry(`Your Block is doubled.`, 'good'))
  }

  if (effect.bonusBlockIfExhaustedThisTurn && combat.exhaustedThisTurn > 0) {
    combat.player.block += effect.bonusBlockIfExhaustedThisTurn
    logs.push(
      createLogEntry(
        `You gain ${effect.bonusBlockIfExhaustedThisTurn} bonus Block.`,
        'good',
      ),
    )
  }

  if (effect.damage !== undefined || effect.damageEqualsBlock) {
    fatalDamageResolved = resolveTargetedDamage(run, combat, definition, effect, target, logs)
  }

  if (effect.damageAll !== undefined) {
    const damage = getPlayerCardDamage(run, combat, effect, true)
    for (const enemy of combat.enemies.filter((candidate) => candidate.currentHp > 0)) {
      const dealt = dealDamageToEnemy(enemy, damage)
      logs.push(
        createLogEntry(
          `${definition.name} hits ${enemy.name} for ${dealt} damage.`,
          dealt > 0 ? 'good' : 'neutral',
        ),
      )
      resolveEnemyAfterHit(combat, enemy, logs)
    }
  }

  if (effect.applyVulnerable && target) {
    target.vulnerable += effect.applyVulnerable
    logs.push(
      createLogEntry(`${target.name} gains ${effect.applyVulnerable} Vulnerable.`, 'good'),
    )
  }

  if (effect.applyVulnerableAll) {
    for (const enemy of combat.enemies.filter((candidate) => candidate.currentHp > 0)) {
      enemy.vulnerable += effect.applyVulnerableAll
      logs.push(
        createLogEntry(
          `${enemy.name} gains ${effect.applyVulnerableAll} Vulnerable.`,
          'good',
        ),
      )
    }
  }

  if (effect.applyWeak && target) {
    target.weak += effect.applyWeak
    logs.push(createLogEntry(`${target.name} gains ${effect.applyWeak} Weak.`, 'good'))
  }

  if (effect.doubleEnemyVulnerable && target) {
    target.vulnerable *= 2
    logs.push(createLogEntry(`${target.name}'s Vulnerable is doubled.`, 'good'))
  }

  if (effect.gainTemporaryStrength) {
    combat.player.temporaryStrength += effect.gainTemporaryStrength
    logs.push(
      createLogEntry(
        `You gain ${effect.gainTemporaryStrength} Strength this turn.`,
        'good',
      ),
    )
  }

  if (effect.gainStrength) {
    combat.player.strength += effect.gainStrength
    logs.push(createLogEntry(`You gain ${effect.gainStrength} Strength.`, 'good'))
  }

  if (effect.gainEnemyStrength && target) {
    target.strength += effect.gainEnemyStrength
    logs.push(
      createLogEntry(
        `${target.name} gains ${effect.gainEnemyStrength} Strength.`,
        'bad',
      ),
    )
  }

  if (effect.drawCards) {
    const drawResult = drawCards(run, combat, effect.drawCards)
    run.rngState = drawResult.run.rngState
    logs.push(
      createLogEntry(
        `You draw ${drawResult.drawn} card${drawResult.drawn > 1 ? 's' : ''}.`,
        'neutral',
      ),
    )
  }

  if (effect.createCopyInDiscard) {
    combat.discardPile.push(createCardInstance(card.cardId, run.deck.length + cardSequence))
    logs.push(
      createLogEntry(`A copy of ${definition.name} flies into your discard pile.`, 'neutral'),
    )
  }

  if (effect.exhaustTopDrawPile) {
    exhaustTopDrawPile(combat, effect.exhaustTopDrawPile, logs)
  }

  if (effect.playTopDrawPileAndExhaust) {
    playTopDrawPileAndExhaust(run, combat, logs)
  }

  if (effect.exhaustRandomHandCard && combat.hand.length > 0) {
    const roll = randomIndex(run.rngState, combat.hand.length)
    run.rngState = roll.next
    const [randomCard] = combat.hand.splice(roll.index, 1)
    moveCardToExhaust(combat, randomCard)
    logs.push(
      createLogEntry(
        `${cardDefinitions[randomCard.cardId].name} is randomly exhausted from your hand.`,
        'neutral',
      ),
    )
  }

  if (effect.exhaustChosenHandCard) {
    if (combat.hand.length > 0) {
      pendingChoice = {
        kind: 'exhaust-hand',
        sourceCardName: definition.name,
        options: combat.hand.filter(() => true),
        drawCardsAfter: effect.drawCardsAfterChosenExhaust,
      }
      logs.push(createLogEntry(`Choose a hand card to exhaust.`, 'neutral'))
    }
  }

  if (effect.exhaustEntireHandForDamage) {
    const cardsToExhaust = [...combat.hand]
    combat.hand = []
    for (const exhaustedCard of cardsToExhaust) {
      moveCardToExhaust(combat, exhaustedCard)
      logs.push(
        createLogEntry(`${cardDefinitions[exhaustedCard.cardId].name} is exhausted.`, 'neutral'),
      )
    }

    const livingEnemies = combat.enemies.filter((enemy) => enemy.currentHp > 0)
    const targetEnemy = target ?? livingEnemies[0]
    if (targetEnemy) {
      for (let index = 0; index < cardsToExhaust.length; index += 1) {
        const dealt = dealDamageToEnemy(targetEnemy, effect.exhaustEntireHandForDamage)
        logs.push(
          createLogEntry(
            `${definition.name} deals ${dealt} damage to ${targetEnemy.name}.`,
            dealt > 0 ? 'good' : 'neutral',
          ),
        )
        resolveEnemyAfterHit(combat, targetEnemy, logs)
        if (targetEnemy.currentHp <= 0) {
          break
        }
      }
    }
  }

  if (effect.retaliateDamageThisTurn) {
    combat.player.retaliateDamage += effect.retaliateDamageThisTurn
    logs.push(
      createLogEntry(
        `You will retaliate for ${effect.retaliateDamageThisTurn} damage this turn.`,
        'good',
      ),
    )
  }

  if (effect.feelNoPainBlock) {
    combat.player.feelNoPainBlock = effect.feelNoPainBlock
    logs.push(
      createLogEntry(
        `Feel No Pain will grant ${effect.feelNoPainBlock} Block whenever a card is Exhausted.`,
        'good',
      ),
    )
  }

  if (effect.upgradeAllHand) {
    for (const handCard of combat.hand) {
      handCard.upgraded = true
    }
    logs.push(createLogEntry('Every card in your hand is upgraded for this combat.', 'good'))
  }

  if (effect.upgradeChosenHandCard) {
    const options = combat.hand.filter((handCard) => !handCard.upgraded)
    if (options.length > 0) {
      pendingChoice = {
        kind: 'upgrade-hand',
        sourceCardName: definition.name,
        options,
      }
      logs.push(createLogEntry(`Choose a card in hand to upgrade.`, 'neutral'))
    }
  }

  if (effect.moveDiscardToDrawTop) {
    const options = [...combat.discardPile].reverse()
    if (options.length > 0) {
      pendingChoice = {
        kind: 'discard-to-draw',
        sourceCardName: definition.name,
        options,
      }
      logs.push(createLogEntry(`Choose a discard pile card to place on top of your draw pile.`, 'neutral'))
    }
  }

  if (effect.fatalMaxHpGain && fatalDamageResolved && target && target.currentHp <= 0) {
    run.maxHp += effect.fatalMaxHpGain
    run.currentHp += effect.fatalMaxHpGain
    logs.push(
      createLogEntry(
        `Feed raises your Max HP by ${effect.fatalMaxHpGain}.`,
        'good',
      ),
    )
  }

  resolveAllEnemyDeaths(combat, logs)
  return pendingChoice
}

function resolveTargetedDamage(
  run: RunState,
  combat: CombatState,
  definition: CardDefinition,
  effect: CardEffect,
  target: EnemyState | undefined,
  logs: LogEntry[],
): boolean {
  const damage = getPlayerCardDamage(run, combat, effect, false, target)
  const hits = effect.hits ?? 1
  let fatal = false

  for (let hit = 0; hit < hits; hit += 1) {
    const resolvedTarget = effect.randomTarget
      ? pickRandomLivingEnemy(run, combat)
      : target

    if (!resolvedTarget) {
      break
    }

    const dealt = dealDamageToEnemy(resolvedTarget, damage)
    logs.push(
      createLogEntry(
        `${definition.name} deals ${dealt} damage to ${resolvedTarget.name}.`,
        dealt > 0 ? 'good' : 'neutral',
      ),
    )
    resolveEnemyAfterHit(combat, resolvedTarget, logs)
    if (resolvedTarget.currentHp <= 0) {
      fatal = true
    }
  }

  return fatal
}

function drawCards(
  run: RunState,
  combat: CombatState,
  amount: number,
): { run: RunState; combat: CombatState; drawn: number } {
  let nextRun = run
  let drawn = 0

  while (drawn < amount) {
    if (combat.drawPile.length === 0) {
      if (combat.discardPile.length === 0) {
        break
      }

      const shuffled = shuffleWithSeed(combat.discardPile, nextRun.rngState)
      nextRun = { ...nextRun, rngState: shuffled.next }
      combat.drawPile = shuffled.result
      combat.discardPile = []
    }

    const nextCard = combat.drawPile.shift()
    if (!nextCard) {
      break
    }

    combat.hand.push(nextCard)
    drawn += 1
  }

  return { run: nextRun, combat, drawn }
}

function pickTarget(
  combat: CombatState,
  definition: CardDefinition,
  targetEnemyId?: string,
): EnemyState | undefined {
  if (!needsTarget(definition)) {
    return undefined
  }

  if (targetEnemyId) {
    return combat.enemies.find(
      (enemy) => enemy.instanceId === targetEnemyId && enemy.currentHp > 0,
    )
  }

  return combat.enemies.find((enemy) => enemy.currentHp > 0)
}

function needsTarget(definition: CardDefinition): boolean {
  if (definition.effect.targetEnemy) {
    return true
  }

  return (
    definition.type === 'attack' &&
    !definition.effect.randomTarget &&
    definition.effect.damageAll === undefined
  )
}

function dealDamageToEnemy(enemy: EnemyState, baseDamage: number): number {
  const adjusted = enemy.vulnerable > 0 ? Math.floor(baseDamage * 1.5) : baseDamage
  const blocked = Math.min(enemy.block, adjusted)
  enemy.block -= blocked
  const hpDamage = adjusted - blocked
  enemy.currentHp = Math.max(0, enemy.currentHp - hpDamage)
  return hpDamage
}

function dealDamageToPlayer(
  run: RunState,
  combat: CombatState,
  enemy: EnemyState,
  baseDamage: number,
): number {
  const withStrength = baseDamage + enemy.strength
  const adjusted =
    combat.player.vulnerable > 0 ? Math.floor(withStrength * 1.5) : withStrength
  const blocked = Math.min(combat.player.block, adjusted)
  combat.player.block -= blocked
  const hpDamage = adjusted - blocked
  run.currentHp = Math.max(0, run.currentHp - hpDamage)
  return hpDamage
}

function getCurrentIntent(enemy: EnemyState) {
  return enemyDefinitions[enemy.definitionId].intentCycle[enemy.intentIndex]
}

function getEncounter(node: MapNode): EncounterDefinition {
  if (node.encounterId && encounterDefinitions[node.encounterId]) {
    return encounterDefinitions[node.encounterId]
  }

  return encounterDefinitions['solo-cultist']
}

function getNextNode(run: RunState): MapNode | undefined {
  const nextIndex = run.currentNodeIndex + 1
  return run.map[nextIndex]
}

function cloneCombat(combat: CombatState): CombatState {
  return {
    ...combat,
    player: { ...combat.player },
    hand: combat.hand.map(cloneCardInstance),
    drawPile: combat.drawPile.map(cloneCardInstance),
    discardPile: combat.discardPile.map(cloneCardInstance),
    exhaustPile: combat.exhaustPile.map(cloneCardInstance),
    enemies: combat.enemies.map((enemy) => ({ ...enemy })),
  }
}

function cloneCardInstance(card: CardInstance): CardInstance {
  return { ...card }
}

function tickDown(value: number): number {
  return Math.max(0, value - 1)
}

function createCardInstance(cardId: CardId, index: number): CardInstance {
  return {
    instanceId: `${cardId}-${index}-${cardSequence++}`,
    cardId,
    upgraded: false,
  }
}

function createEnemyState(enemyId: EnemyId, floor: number, index: number): EnemyState {
  const definition = enemyDefinitions[enemyId]
  return {
    instanceId: `enemy-${floor}-${index}`,
    definitionId: definition.id,
    name: definition.name,
    currentHp: definition.maxHp,
    maxHp: definition.maxHp,
    block: 0,
    strength: 0,
    ritual: 0,
    vulnerable: 0,
    weak: 0,
    intentIndex: 0,
    curlUpUsed: false,
    deathResolved: false,
  }
}

function getPlayerCardDamage(
  run: RunState,
  combat: CombatState,
  effect: CardEffect,
  useAreaDamage = false,
  target?: EnemyState,
): number {
  if (effect.damageEqualsBlock) {
    return combat.player.block
  }

  const base = useAreaDamage ? effect.damageAll ?? 0 : effect.damage ?? 0
  const strikeBonus = effect.scaleWithStrikeCards
    ? countStrikeCards(run) * effect.scaleWithStrikeCards
    : 0
  const exhaustBonus = effect.scaleWithExhaustPile
    ? combat.exhaustPile.length * effect.scaleWithExhaustPile
    : 0
  const vulnerableBonus =
    !useAreaDamage && effect.scaleWithEnemyVulnerable
      ? (target?.vulnerable ?? 0) * effect.scaleWithEnemyVulnerable
      : 0
  const total =
    base +
    strikeBonus +
    exhaustBonus +
    vulnerableBonus +
    combat.player.strength +
    combat.player.temporaryStrength

  if (combat.player.weak > 0) {
    return Math.max(0, Math.floor(total * 0.75))
  }

  return total
}

function getCardCost(card: CardInstance): number {
  const definition = cardDefinitions[card.cardId]
  if (card.upgraded && definition.upgradedCost !== undefined) {
    return definition.upgradedCost
  }
  return definition.cost
}

function countStrikeCards(run: RunState): number {
  return run.deck.filter((card) =>
    cardDefinitions[card.cardId].name.toLowerCase().includes('strike'),
  ).length
}

function pickRandomLivingEnemy(
  run: RunState,
  combat: CombatState,
): EnemyState | undefined {
  const livingEnemies = combat.enemies.filter((enemy) => enemy.currentHp > 0)
  if (livingEnemies.length === 0) {
    return undefined
  }

  const roll = randomIndex(run.rngState, livingEnemies.length)
  run.rngState = roll.next
  return livingEnemies[roll.index]
}

function moveCardToExhaust(combat: CombatState, card: CardInstance): void {
  combat.exhaustPile.push(card)
  combat.exhaustedThisTurn += 1
  if (combat.player.feelNoPainBlock > 0) {
    combat.player.block += combat.player.feelNoPainBlock
  }
}

function exhaustTopDrawPile(
  combat: CombatState,
  count: number,
  logs: LogEntry[],
): void {
  for (let index = 0; index < count; index += 1) {
    const topCard = combat.drawPile.shift()
    if (!topCard) {
      break
    }

    moveCardToExhaust(combat, topCard)
    logs.push(
      createLogEntry(
        `${cardDefinitions[topCard.cardId].name} is exhausted from the top of your draw pile.`,
        'neutral',
      ),
    )
  }
}

function playTopDrawPileAndExhaust(
  run: RunState,
  combat: CombatState,
  logs: LogEntry[],
): void {
  const topCard = combat.drawPile.shift()
  if (!topCard) {
    logs.push(createLogEntry('There is no card on top of your draw pile.', 'neutral'))
    return
  }

  const definition = cardDefinitions[topCard.cardId]
  const effect = topCard.upgraded ? definition.upgradedEffect : definition.effect
  const target = pickTarget(combat, definition)

  logs.push(
    createLogEntry(
      `Havoc plays ${definition.name} from the top of your draw pile.`,
      'good',
    ),
  )

  const nestedPendingChoice = resolveCardEffect(run, combat, topCard, definition, effect, target, logs)
  if (nestedPendingChoice) {
    logs.push(createLogEntry(`${definition.name}'s follow-up choice is skipped in Havoc.`, 'neutral'))
  }
  moveCardToExhaust(combat, topCard)
  logs.push(createLogEntry(`${definition.name} is exhausted.`, 'neutral'))
}

function resolveEnemyAfterHit(
  combat: CombatState,
  enemy: EnemyState,
  logs: LogEntry[],
): void {
  const definition = enemyDefinitions[enemy.definitionId]

  if (definition.passive?.curlUpBlock && !enemy.curlUpUsed && enemy.currentHp > 0) {
    enemy.block += definition.passive.curlUpBlock
    enemy.curlUpUsed = true
    logs.push(
      createLogEntry(
        `${enemy.name}'s Curl Up grants ${definition.passive.curlUpBlock} Block.`,
        'neutral',
      ),
    )
  }

  resolveEnemyDeaths([enemy], combat, logs)
}

function resolveAllEnemyDeaths(combat: CombatState, logs: LogEntry[]): void {
  resolveEnemyDeaths(combat.enemies, combat, logs)
}

function resolveEnemyDeaths(
  enemies: EnemyState[],
  combat: CombatState,
  logs: LogEntry[],
): void {
  for (const enemy of enemies) {
    if (enemy.currentHp > 0 || enemy.deathResolved) {
      continue
    }

    enemy.deathResolved = true
    const passive = enemyDefinitions[enemy.definitionId].passive
    if (passive?.onDeathApplyVulnerable) {
      combat.player.vulnerable += passive.onDeathApplyVulnerable
      logs.push(
        createLogEntry(
          `${enemy.name}'s spores apply ${passive.onDeathApplyVulnerable} Vulnerable to you.`,
          'bad',
        ),
      )
    }
  }
}

function createLogEntry(message: string, tone: Tone): LogEntry {
  return {
    id: `log-${logSequence++}`,
    message,
    tone,
  }
}

function appendLogs(existing: LogEntry[], nextEntries: LogEntry[]): LogEntry[] {
  return [...existing, ...nextEntries].slice(-MAX_LOG_ENTRIES)
}

function appendStateLogs(state: GameState, nextEntries: LogEntry[]): GameState {
  return {
    ...state,
    ui: {
      ...state.ui,
      log: appendLogs(state.ui.log, nextEntries),
    },
  }
}
