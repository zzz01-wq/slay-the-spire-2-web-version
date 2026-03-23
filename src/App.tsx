import { useReducer } from 'react'
import './App.css'
import { createInitialGameState, reduceGameState } from './game/core/game-engine.ts'
import { createViewModel } from './game/core/view-model.ts'
import { GameScreen } from './game/ui/GameScreen.tsx'

function App() {
  const [state, dispatch] = useReducer(
    reduceGameState,
    undefined,
    createInitialGameState,
  )

  const viewModel = createViewModel(state)

  return <GameScreen viewModel={viewModel} dispatch={dispatch} />
}

export default App
