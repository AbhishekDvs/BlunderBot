import { Suspense } from 'react'
import { GameBoard } from './GameBoard'
import { NewGameButton } from './NewGameButton'

export default async function GamePage({ searchParams }: { searchParams: Record<string, string> }) {
  const difficulty = searchParams?.difficulty || 'easy'

  return (
    <main className="min-h-screen bg-[#1F1D2B] text-white flex flex-col md:flex-row">
      <div className="w-full md:w-3/4 flex items-center justify-center p-4">
        <Suspense fallback={<div>Loading board...</div>}>
          <GameBoard difficulty={difficulty} />
        </Suspense>
      </div>
      <div className="w-full md:w-1/4 bg-[#2A2937] p-4 space-y-4 border-l border-gray-700">
        <h2 className="text-xl font-bold text-yellow-400">BlunderBot Says:</h2>
        <div className="bg-[#3A3949] p-3 rounded-xl shadow-inner">
          “Nice move. If your goal is to lose.”
        </div>
        <div className="text-sm text-gray-300">
          Difficulty: <span className="capitalize">{difficulty}</span>
        </div>
        <NewGameButton />
      </div>
    </main>
  )
}
