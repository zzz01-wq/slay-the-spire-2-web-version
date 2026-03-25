import { useState, type Dispatch } from 'react'
import stS2EnergyIroncladIcon from '../../assets/StS2_EnergyIronclad.png'
import stS2StrengthIcon from '../../assets/StS2_Icon_Strength.png'
import stS2VulnerableIcon from '../../assets/StS2_Icon_Vulnerable.png'
import stS2WeakIcon from '../../assets/StS2_Icon_Weak.png'
import stS2DefendIntentIcon from '../../assets/StS2_Intent_Defend.png'
import ritualIcon from '../../assets/Icon_Ritual.png'
import type { GameAction, InspectablePile, ViewModel } from '../types.ts'

type GameScreenProps = {
  viewModel: ViewModel
  dispatch: Dispatch<GameAction>
}

const ICON_URLS: Record<string, string> = {
  energy: stS2EnergyIroncladIcon,
  strength: stS2StrengthIcon,
  block: stS2DefendIntentIcon,
  ritual: ritualIcon,
  vulnerable: stS2VulnerableIcon,
  weak: stS2WeakIcon,
}

type ParsedCardLine = {
  name: string
  cost: string
  description: string
}

export function GameScreen({ viewModel, dispatch }: GameScreenProps) {
  const [openPileId, setOpenPileId] = useState<InspectablePile['id'] | null>(null)
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null)
  const openPile =
    viewModel.inspectablePiles.find((pile) => pile.id === openPileId) ?? null
  const selectedHandCard =
    viewModel.handCards.find((card) => card.instanceId === selectedHandCardId) ?? null
  const combatEndTurnAction =
    viewModel.combatSummary
      ? viewModel.actions.find((action) => action.action.type === 'END_TURN') ?? null
      : null

  return (
    <main className="game-shell">
      <header className="game-header">
        <h1>{viewModel.title}</h1>
        <p className="subtitle">{viewModel.subtitle}</p>
        <div className="badge-row">
          {viewModel.statusBadges.map((badge) => (
            <span className="badge" key={badge}>
              {badge}
            </span>
          ))}
        </div>
      </header>

      <section className="game-main">
        <div className="panel-stack">
          {viewModel.combatSummary ? (
            <section className="combat-summary">
              <article className="panel combat-summary__player">
                <h2>Combat Turn {viewModel.combatSummary.turn}</h2>
                <div className="stat-token-row">
                  {viewModel.combatSummary.playerStats.map((stat) => (
                    <div className="stat-token" key={stat.key}>
                      {renderStatIcon(stat.key, stat.label)}
                      <span className="stat-token__value">{stat.value}</span>
                      <span className="stat-token__label">{stat.label}</span>
                    </div>
                  ))}
                </div>
                {viewModel.combatSummary.powersText ? (
                  <p className="combat-summary__powers">{viewModel.combatSummary.powersText}</p>
                ) : null}
              </article>

              <article className="panel combat-summary__enemies">
                <h2>Enemies</h2>
                <div className="enemy-summary-list">
                  {viewModel.combatSummary.enemies.map((enemy) => (
                    <section className="enemy-summary-card" key={enemy.id}>
                      <div className="enemy-summary-card__header">
                        <strong>{enemy.name}</strong>
                        <span>
                          HP {enemy.currentHp}/{enemy.maxHp}
                        </span>
                      </div>
                      <div className="stat-token-row stat-token-row--enemy">
                        {enemy.stats.map((stat) => (
                          <div className="stat-token stat-token--enemy" key={`${enemy.id}-${stat.key}`}>
                            {renderStatIcon(stat.key, stat.label)}
                            <span className="stat-token__value">{stat.value}</span>
                            <span className="stat-token__label">{stat.label}</span>
                          </div>
                        ))}
                      </div>
                      <p className="enemy-summary-card__intent">Intent: {enemy.intent}</p>
                    </section>
                  ))}
                </div>
              </article>
            </section>
          ) : null}

          {viewModel.panels.map((panel) => (
            <article className="panel" key={panel.id}>
              <h2>{panel.title}</h2>
              {renderPanelLines(panel.id, panel.lines)}
            </article>
          ))}
        </div>

        <aside className="side-column">
          {viewModel.inspectablePiles.length > 0 ? (
            <section className="action-panel">
              <h2>Combat Piles</h2>
              <section className="pile-strip pile-strip--sidebar" aria-label="Combat piles">
                {viewModel.inspectablePiles.map((pile) => (
                  <button
                    className="pile-card"
                    key={pile.id}
                    onClick={() => setOpenPileId(pile.id)}
                    type="button"
                  >
                    <span className="pile-card__title">{pile.title}</span>
                    <span className="pile-card__count">{pile.count}</span>
                    <span className="pile-card__summary">{pile.summary}</span>
                  </button>
                ))}
              </section>
            </section>
          ) : null}

          {viewModel.handCards.length > 0 ? (
            <section className="action-panel hand-panel">
              <div className="hand-panel__header">
                <h2>Hand</h2>
                {combatEndTurnAction ? (
                  <button
                    className="action-button action-button--end-turn"
                    disabled={combatEndTurnAction.disabled}
                    onClick={() => dispatch(combatEndTurnAction.action)}
                    type="button"
                  >
                    {combatEndTurnAction.label}
                  </button>
                ) : null}
              </div>
              <div className="hand-grid hand-grid--sidebar">
                {viewModel.handCards.map((card) => (
                  <button
                    className={`hand-card ${card.disabled ? 'is-disabled' : ''}`}
                    key={card.instanceId}
                    onClick={() => setSelectedHandCardId(card.instanceId)}
                    type="button"
                  >
                    <span className="card-line">
                      <span className="card-line__header">
                        <span className="card-line__name">{card.name}</span>
                        <span className="card-line__cost">
                          <img
                            alt="Energy cost"
                            className="card-line__cost-icon"
                            src={stS2EnergyIroncladIcon}
                          />
                          <span>{card.cost}</span>
                        </span>
                      </span>
                      <span className="card-line__description">{card.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {viewModel.choicePanel ? (
            <section className="action-panel">
              <h2>{viewModel.choicePanel.title}</h2>
              {renderChoiceLines(viewModel.choicePanel.lines)}
            </section>
          ) : null}

          {!viewModel.combatSummary ? (
            <section className="action-panel">
              <h2>Available Actions</h2>
              <div className="action-grid">
                {viewModel.actions.map((action) => (
                  <button
                    className="action-button"
                    disabled={action.disabled}
                    key={action.id}
                    onClick={() => dispatch(action.action)}
                    type="button"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </section>

      {openPile ? (
        <div
          aria-modal="true"
          className="pile-modal-backdrop"
          onClick={() => setOpenPileId(null)}
          role="dialog"
        >
          <section className="pile-modal" onClick={(event) => event.stopPropagation()}>
            <div className="pile-modal__header">
              <div>
                <h2>{openPile.title}</h2>
                <p>{openPile.count} cards</p>
              </div>
              <button
                className="pile-modal__close"
                onClick={() => setOpenPileId(null)}
                type="button"
              >
                Close
              </button>
            </div>
            <ul className="pile-modal__list">
              {openPile.lines.map((line, index) => (
                <li key={`${openPile.id}-${index}`}>
                  {renderMaybeCardLine(line, `pile-${openPile.id}-${index}`)}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {selectedHandCard ? (
        <div
          aria-modal="true"
          className="pile-modal-backdrop"
          onClick={() => setSelectedHandCardId(null)}
          role="dialog"
        >
          <section className="pile-modal hand-action-modal" onClick={(event) => event.stopPropagation()}>
            <div className="pile-modal__header">
              <div>
                <h2>{selectedHandCard.name}</h2>
                <p>{selectedHandCard.description}</p>
              </div>
              <button
                className="pile-modal__close"
                onClick={() => setSelectedHandCardId(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="hand-action-modal__body">
              <div className="hand-action-modal__cost">
                <img
                  alt="Energy cost"
                  className="card-line__cost-icon"
                  src={stS2EnergyIroncladIcon}
                />
                <span>{selectedHandCard.cost}</span>
              </div>

              {selectedHandCard.disabled ? (
                <p className="hand-action-modal__hint">{selectedHandCard.disabledReason}</p>
              ) : null}

              <div className="hand-action-modal__actions">
                {selectedHandCard.targetMode === 'enemy'
                  ? selectedHandCard.targets.map((target) => (
                      <button
                        className="action-button"
                        key={target.enemyId}
                        onClick={() => {
                          dispatch({
                            type: 'PLAY_CARD',
                            cardInstanceId: selectedHandCard.instanceId,
                            targetEnemyId: target.enemyId,
                          })
                          setSelectedHandCardId(null)
                        }}
                        type="button"
                      >
                        Play on {target.enemyName}
                      </button>
                    ))
                  : (
                    <button
                      className="action-button"
                      disabled={selectedHandCard.disabled}
                      onClick={() => {
                        dispatch({
                          type: 'PLAY_CARD',
                          cardInstanceId: selectedHandCard.instanceId,
                        })
                        setSelectedHandCardId(null)
                      }}
                      type="button"
                    >
                      {selectedHandCard.targetMode === 'all'
                        ? 'Play on all enemies'
                        : selectedHandCard.targetMode === 'random'
                          ? 'Play with random target'
                          : 'Play card'}
                    </button>
                    )}

                <button
                  className="action-button action-button--secondary"
                  onClick={() => setSelectedHandCardId(null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function renderPanelLines(panelId: string, lines: string[]) {
  const useCardRenderer = panelId === 'hand' || panelId === 'reward'

  return (
    <ul>
      {lines.map((line, index) => (
        <li key={`${panelId}-${index}`}>
          {useCardRenderer ? renderMaybeCardLine(line, `${panelId}-${index}`) : line}
        </li>
      ))}
    </ul>
  )
}

function renderChoiceLines(lines: string[]) {
  return (
    <ul className="choice-list">
      {lines.map((line, index) => (
        <li key={`choice-${index}`}>
          {index === 0 ? line : renderMaybeCardLine(line, `choice-${index}`)}
        </li>
      ))}
    </ul>
  )
}

function renderMaybeCardLine(line: string, key: string) {
  const parsed = parseCardLine(line)
  if (!parsed) {
    return line
  }

  return (
    <span className="card-line" key={key}>
      <span className="card-line__header">
        <span className="card-line__name">{parsed.name}</span>
        <span className="card-line__cost">
          <img
            alt="Energy cost"
            className="card-line__cost-icon"
            src={stS2EnergyIroncladIcon}
          />
          <span>{parsed.cost}</span>
        </span>
      </span>
      <span className="card-line__description">{parsed.description}</span>
    </span>
  )
}

function renderStatIcon(statKey: string, label: string) {
  const src = ICON_URLS[statKey]
  if (src) {
    return <img alt={label} className="stat-token__icon" src={src} />
  }

  return <span className="stat-token__fallback">{label.slice(0, 1)}</span>
}

function parseCardLine(line: string): ParsedCardLine | null {
  const match = /^(.*) \((\d+)\) - (.*)$/.exec(line)
  if (!match) {
    return null
  }

  return {
    name: match[1],
    cost: match[2],
    description: match[3],
  }
}
