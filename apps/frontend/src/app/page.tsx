'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

const difficulties = [
  { label: '♻️ WALL·E - Easy', value: 'easy', color: 'bg-emerald-500' },
  { label: '🤖 R2-D2 - Medium', value: 'medium', color: 'bg-blue-500' },
  { label: '🧬 Ultron - Hard', value: 'hard', color: 'bg-indigo-600' },
  { label: '🔥 T-800 - Insane', value: 'insane', color: 'bg-neutral-800' }
]



export default function Home() {
  const [selected, setSelected] = useState<string | null>(null)
  const [side, setSide] = useState<'white' | 'black'>('white')
  const router = useRouter()

  const handleSelect = (level: string) => {
    setSelected(level)
    setTimeout(() => {
      router.push(`/game?difficulty=${level}&side=${side}`)
    }, 500)
  }

  function getSpyRoast(level: string): string {
    switch (level) {
      case 'easy':
        return "Will hang a queen just to see what happens."
      case 'medium':
        return "Tactical but still falls for forks and pins."
      case 'hard':
        return "Punishes mistakes like it's MI6 protocol."
      case 'insane':
        return "Cold, brutal logic. No soul. Just Stockfish."
      default:
        return "Unknown agent."
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1F1D2B] to-[#0F0E17] text-white px-4">
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center space-y-8 max-w-xl"
      >
        <h1 className="text-4xl md:text-6xl font-extrabold text-yellow-400 drop-shadow-md">
          Welcome to BlunderBot
        </h1>
        <p className="text-lg md:text-xl text-gray-300">
          Select your mission difficulty. No second chances.
        </p>

        <div className="mt-6">
          <p className="text-gray-300 mb-2 text-sm">Choose your side:</p>
          <div className="flex justify-center gap-4">
            <button
              className={`px-4 cursor-pointer py-2 rounded-xl ${side === 'white' ? 'bg-blue-600' : 'bg-gray-700'} text-white`}
              onClick={() => setSide('white')}
            >
              ♙ White
            </button>
            <button
              className={`px-4 cursor-pointer py-2 rounded-xl ${side === 'black' ? 'bg-blue-600' : 'bg-gray-700'} text-white`}
              onClick={() => setSide('black')}
            >
              ♟ Black
            </button>
          </div>
        </div>
        <p className="text-gray-300 mb-2 text-sm">Choose your opponent:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {difficulties.map(d => (
           <div
            key={d.value}
            className="rounded-xl p-4 shadow-lg hover:scale-105 transition cursor-pointer bg-white/10 backdrop-blur-md border border-white/20"
            onClick={() => handleSelect(d.value)}
          >
            <h3 className="text-xl font-bold text-white">{d.label}</h3>
            <p className="text-sm text-gray-300 mt-1">
              {getSpyRoast(d.value)}
            </p>
          </div>

          ))}
        </div>

        {selected && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-gray-400 mt-2"
          >
            Loading {selected} game...
          </motion.p>
        )}
      </motion.div>
    </main>
  )
}
