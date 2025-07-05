'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

const difficulties = [
  { label: '🍼 BabyBot', value: 'easy', color: 'bg-green-500' },
  { label: '🧠 MidBot', value: 'medium', color: 'bg-yellow-500' },
  { label: '🤖 Evil Genius', value: 'hard', color: 'bg-red-500' }
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
          {difficulties.map((d) => (
            <button
              key={d.value}
              onClick={() => handleSelect(d.value)}
              className={`py-3 px-6 rounded-2xl cursor-pointer font-semibold text-white text-lg shadow-md hover:scale-105 active:scale-95 transition-transform duration-150 ${d.color} ${
                selected === d.value ? 'ring-4 ring-white' : ''
              }`}
            >
              {d.label}
            </button>
          ))}
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
