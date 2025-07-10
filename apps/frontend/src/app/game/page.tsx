import { Suspense } from 'react'
import GameClient from './GameClient'

export default function GamePage() {
  return (
    <Suspense fallback={<div className="text-white">Loading game...</div>}>
      <GameClient />
    </Suspense>
  )
}
