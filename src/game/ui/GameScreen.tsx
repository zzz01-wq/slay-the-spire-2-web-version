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
  const openPile =
    viewModel.inspectablePiles.find((pile) => pile.id === openPileId) ?? null

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

          {viewModel.inspectablePiles.length > 0 ? (
            <section className="pile-strip" aria-label="Combat piles">
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
          ) : null}

          {viewModel.panels.map((panel) => (
            <article className="panel" key={panel.id}>
              <h2>{panel.title}</h2>
              {renderPanelLines(panel.id, panel.lines)}
            </article>
          ))}
        </div>

        <aside className="side-column">
          {viewModel.choicePanel ? (
            <section className="action-panel">
              <h2>{viewModel.choicePanel.title}</h2>
              {renderChoiceLines(viewModel.choicePanel.lines)}
            </section>
          ) : null}

          <section className="log-panel">
            <h2>Battle Log</h2>
            <ul>
              {viewModel.log.map((entry) => (
                <li className={`log-entry ${entry.tone}`} key={entry.id}>
                  {entry.message}
                </li>
              ))}
            </ul>
          </section>

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
