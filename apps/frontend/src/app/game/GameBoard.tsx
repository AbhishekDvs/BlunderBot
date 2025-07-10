'use client'

import { useRef, useState , useEffect } from 'react'
import { Chess } from 'chess.js'
import Image from 'next/image'
import { Chessboard } from 'react-chessboard'
import { BoardOrientation } from 'react-chessboard/dist/chessboard/types'
import { useStockfish } from '@/hooks/useStockfish'
import type { Move, Square } from 'chess.js'
import { toPng } from 'html-to-image';
import { boardThemes , BoardThemeKey } from '@/constants/themes'

type PieceStyle = 'default' | 'pirouetti' | 'chestnut'

export function GameBoard({
  difficulty,
  pieceStyle,
  side,
  boardTheme
}: {
  difficulty: string
  pieceStyle: PieceStyle,
  side:BoardOrientation,
  boardTheme: BoardThemeKey
}) {
  const { postMessage } = useStockfish((bestMove: string) => {
    if (bestMove && bestMove.length === 4) {
      const from = bestMove.substring(0, 2);
      const to = bestMove.substring(2, 4);
      const promotion = bestMove.length >= 5 ? bestMove[4] : undefined;

      const move = game.current.move({
        from,
        to,
        promotion
      });


      if (move) {
        setFen(game.current.fen());
        console.log(`[SF BOT (${difficulty})] plays: ${move.san}`);
        if (game.current.isGameOver()) handleGameOver();
      }
    }
  });

  const game = useRef(new Chess())
  const [fen, setFen] = useState(game.current.fen())
  const [gameOver, setGameOver] = useState(false)
  const [resultMessage, setResultMessage] = useState('')
  const moveHistory = game.current.history();
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [highlightedSquares, setHighlightedSquares] = useState<{ [square: string]: React.CSSProperties }>({});
  const [boardWidth, setBoardWidth] = useState(400)
  const [showModal, setShowModal] = useState(true);
  const [copiedPGN, setCopiedPGN] = useState(false);
  const boardOnlyRef = useRef<HTMLDivElement>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const theme = boardThemes[boardTheme];

  const pieceNames = ['P', 'N', 'B', 'R', 'Q', 'K']
  const colors = ['w', 'b']

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (side === 'black') {
      makeBotMove()
    }
  }, [side])

  useEffect(() => {
  const handleResize = () => {
    setBoardWidth(Math.min(500, window.innerWidth - 32)) 
  }

  handleResize() 
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])

  function onSquareClick(square: string) {
  const moves = game.current.moves({ square: square as Square, verbose: true }) as Move[];

  if (selectedSquare && highlightedSquares[square]) {
    const move = game.current.move({
      from: selectedSquare,
      to: square,
      promotion: 'q',
    });

    setSelectedSquare(null);
    setHighlightedSquares({});
    if (move) {
      setFen(game.current.fen());
      console.log(`[YOU] played: ${move.san}`);
      setTimeout(makeBotMove, 500);
    }
    return;
  }

  if (moves.length === 0) {
    setSelectedSquare(null);
    setHighlightedSquares({});
    return;
  }

  const newHighlights: { [square: string]: React.CSSProperties } = {};
  moves.forEach(m => {
    newHighlights[m.to] = {
      background: 'radial-gradient(circle, rgba(255,255,0,0.3) 40%, transparent 50%)',
      borderRadius: '50%',
    };
  });

  setSelectedSquare(square);
  setHighlightedSquares(newHighlights);
}

const handleCopyPGN = () => {
  const pgn = game.current.pgn();
  navigator.clipboard.writeText(pgn).then(() => {
    setCopiedPGN(true);
    setTimeout(() => setCopiedPGN(false), 2000);
  });
};


  function getCustomPieces(style: string) {
    if (style === 'default') return undefined

    const basePath = `/pieces/${style}`

    return Object.fromEntries(
      colors.flatMap(color =>
        pieceNames.map(name => {
          const code = `${color}${name}`
          return [
            code,
            ({ squareWidth }: { squareWidth: number }) => (
              <Image
                src={`${basePath}/${code}.svg`}
                alt={code}
                width={squareWidth}
                height={squareWidth}
                draggable={false}
                style={{
                  pointerEvents: 'none',
                  userSelect: 'none',
                  display: 'block'
                }}
              />
            )
          ]
        })
      )
    )
  }

  function handleGameOver() {
  let message = '';

  if (game.current.isCheckmate()) {
    message = game.current.turn() === 'w' ? '💀 BlunderBot wins!' : '🎉 You win!';
  } else if (game.current.isStalemate()) {
    message = "😶 Stalemate. It's a draw!";
  } else if (game.current.isThreefoldRepetition()) {
    message = "🔁 Threefold repetition. It's a draw!";
  } else if (game.current.isInsufficientMaterial()) {
    message = "🧮 Insufficient material. It's a draw!";
  } else if (game.current.isDraw()) {
    message = "🤝 It's a draw by rule!";
  } else {
    message = 'Game over!';
  }

  setResultMessage(message);
  setGameOver(true);
}


  const getSearchCommand = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'go depth 3';
      case 'medium': return 'go depth 6';
      case 'hard': return 'go depth 10';
      case 'insane': return 'go depth 20';
      default: return 'go depth 8';
    }
  };


  function makeBotMove() {
  if (game.current.isGameOver()) return;

    postMessage('ucinewgame');
    postMessage(`position fen ${game.current.fen()}`);
    postMessage(getSearchCommand(difficulty));
  }

  const handlePieceDrop = (source: string, target: string): boolean => {
  const piece = game.current.get(source as Square)

  if (
    piece?.type === 'p' &&
    ((piece.color === 'w' && target[1] === '8') ||
     (piece.color === 'b' && target[1] === '1'))
  ) {
    setPendingPromotion({ from: source, to: target });
    return false; 
  }

  const move = game.current.move({
    from: source,
    to: target,
  });

    if (!move) return false;

    setFen(game.current.fen());
    if (game.current.isGameOver()) handleGameOver();
    else setTimeout(makeBotMove, 500);

    return true;
  };

  const handleDownloadPGN = () => {
    const pgn = game.current.pgn();
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'blunderbot_game.pgn';
    a.click();

    URL.revokeObjectURL(url);
  };


  const resetGame = () => {
    game.current.reset()
    setFen(game.current.fen())
    setGameOver(false)
    setResultMessage('')
  }

  const exportBoardAsPNG = async () => {
  if (!boardOnlyRef.current) return;

  const dataUrl = await toPng(boardOnlyRef.current);
  const link = document.createElement('a');
  link.download = 'blunderbot_board.png';
  link.href = dataUrl;
  link.click();
};




  const boardRef = useRef<HTMLDivElement>(null);

  return (
  <div
    ref={boardRef}
    className="relative w-full max-w-full sm:max-w-[500px] aspect-square mx-auto px-2"
  >
    {pendingPromotion && (
      <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-20 p-4">
        <div className="bg-[#2A2937] text-white p-4 rounded-xl space-y-4 shadow-lg text-center w-full max-w-xs">
          <h3 className="text-lg font-bold">Promote to:</h3>
          <div className="flex justify-center flex-wrap gap-3">
            {['q', 'r', 'b', 'n'].map((p) => (
              <button
                key={p}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-2 rounded"
                onClick={() => {
                  const move = game.current.move({
                    from: pendingPromotion.from,
                    to: pendingPromotion.to,
                    promotion: p as 'q' | 'r' | 'b' | 'n',
                  });

                  if (move) {
                    setFen(game.current.fen());
                    if (game.current.isGameOver()) handleGameOver();
                    else setTimeout(makeBotMove, 500);
                  }

                  setPendingPromotion(null);
                }}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    )}

    <div ref={boardOnlyRef} className="w-full">
      <Chessboard
        position={fen}
        onPieceDrop={handlePieceDrop}
        customPieces={getCustomPieces(pieceStyle)}
        customSquareStyles={highlightedSquares}
        onSquareClick={onSquareClick}
        arePiecesDraggable={true}
        boardOrientation={side}
        animationDuration={side === 'black' ? 0 : 300}
        boardWidth={boardWidth}
        customDarkSquareStyle={{ backgroundColor: theme.dark }}
        customLightSquareStyle={{ backgroundColor: theme.light }}
      />
    </div>

    
    {gameOver && showModal && (
      <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-10 p-4">
        <div className="bg-[#2A2937] border border-yellow-400 text-white p-6 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4">
          <h2 className="text-2xl font-bold text-center">🧠 Game Over</h2>
          <p className="text-lg text-center">{resultMessage}</p>
          <div className="max-h-32 overflow-y-auto bg-[#1F1D2B] p-2 rounded text-sm text-left border border-gray-600">
            <h3 className="text-yellow-400 font-semibold mb-1">📝 Moves:</h3>
            <ol className="list-decimal list-inside space-y-1">
              {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => {
                const white = moveHistory[2 * i];
                const black = moveHistory[2 * i + 1];
                return (
                  <li key={i}>
                    {i + 1}. {white} {black ?? ''}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              onClick={resetGame}
            >
              🔁 Play Again
            </button>

            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
              onClick={handleCopyPGN}
            >
              📋 {copiedPGN ? 'Copied PGN!' : 'Copy PGN'}
            </button>

            <button
              className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition"
              onClick={handleDownloadPGN}
            >
              ⬇️ Download PGN
            </button>

            <button
              onClick={exportBoardAsPNG}
              className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition"
            >
              🖼️ Export Board as PNG
            </button>

            <button
              className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition col-span-full"
              onClick={() => setShowModal(false)}
            >
              👀 View Final Board
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);

}
