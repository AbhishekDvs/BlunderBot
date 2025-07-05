'use client'

export function NewGameButton() {
  return (
    <button
      className="w-full cursor-pointer py-2 mt-4 bg-red-500 hover:bg-red-600 rounded-xl text-white font-semibold transition"
      onClick={() => {
        window.location.href = '/'
      }}
    >
      🔁 New Game
    </button>
  )
}
