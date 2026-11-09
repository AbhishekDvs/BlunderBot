'use client'

import { useRouter } from 'next/navigation'

export function NewGameButton() {
  const router = useRouter()

  return (
    <button
      type="button"
      className="w-full cursor-pointer py-2 mt-4 bg-red-500 hover:bg-red-600 rounded-xl text-white font-semibold transition"
      onClick={() => {
        router.push('/')
      }}
    >
      🔁 New Game
    </button>
  )
}
