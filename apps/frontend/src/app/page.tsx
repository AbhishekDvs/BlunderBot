'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

const difficulties = [
  { label: '🧢 Austin Powers', value: 'easy', color: 'bg-emerald-500' },  // Silly fun
  { label: '🕶 Ethan Hunt', value: 'medium', color: 'bg-blue-500' },      // Tactical but beatable
  { label: '🍸 James Bond', value: 'hard', color: 'bg-indigo-600' },      // Stylish assassin
  { label: '👁 George Smiley', value: 'insane', color: 'bg-neutral-800' } // Pure intellect (Stockfish max)
]


export default function Home() {
  const [selected, setSelected] = useState<string | null>(null)
  const router = useRouter()

  const handleSelect = (level: string) => {
    setSelected(level)

    setTimeout(() => {
      router.push(`/game?difficulty=${level}`)
    }, 500)
  }

  function getSpyRoast(level: string): string {
    switch (level) {
      case 'easy':
        return "Will hang a queen just to see what happens.";
      case 'medium':
        return "Tactical but still falls for forks and pins.";
      case 'hard':
        return "Punishes mistakes like it's MI6 protocol.";
      case 'insane':
        return "Cold, brutal logic. No soul. Just Stockfish.";
      default:
        return "Unknown agent.";
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
          Get roasted while you lose in style. Select your doom level:
        </p>

        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {difficulties.map(d => (
              <div key={d.value} className="bg-[#1e1e2e] rounded-xl p-4 shadow-md hover:scale-105 transition cursor-pointer" onClick={() => handleSelect(d.value)}>
                <h3 className="text-xl font-bold text-white">{d.label}</h3>
                <p className="text-sm text-gray-300 mt-1">Known for: {getSpyRoast(d.value)}</p>
              </div>
            ))}
          </motion.div>

        </div>

        {selected && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-gray-400"
          >
            Loading {selected} game...
          </motion.p>
        )}
      </motion.div>
    </main>
  )
}
