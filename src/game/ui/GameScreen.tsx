import type { Dispatch } from 'react'
import type { GameAction, ViewModel } from '../types.ts'

type GameScreenProps = {
  viewModel: ViewModel
  dispatch: Dispatch<GameAction>
}

export function GameScreen({ viewModel, dispatch }: GameScreenProps) {
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
    </main>
  )
}
