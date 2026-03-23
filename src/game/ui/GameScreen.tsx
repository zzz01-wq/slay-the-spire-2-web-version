import { useState, type Dispatch } from 'react'
import type { GameAction, InspectablePile, ViewModel } from '../types.ts'

type GameScreenProps = {
  viewModel: ViewModel
  dispatch: Dispatch<GameAction>
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
              <ul>
                {panel.lines.map((line, index) => (
                  <li key={`${panel.id}-${index}`}>{line}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <aside className="side-column">
          {viewModel.choicePanel ? (
            <section className="action-panel">
              <h2>{viewModel.choicePanel.title}</h2>
              <ul className="choice-list">
                {viewModel.choicePanel.lines.map((line, index) => (
                  <li key={`choice-${index}`}>{line}</li>
                ))}
              </ul>
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
                <li key={`${openPile.id}-${index}`}>{line}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </main>
  )
}
