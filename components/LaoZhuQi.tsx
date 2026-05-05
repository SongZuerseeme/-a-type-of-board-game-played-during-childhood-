import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LucideRotateCcw, LucideTrophy, LucideScale, LucideUser, LucideGhost } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type PieceType = 'PIG' | 'SOLDIER';
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type Point = { x: number; y: number };
type CaptureType = 'VERTEX' | 'SHOULDER' | 'FIVELINE';

interface CaptureGroup {
  id: string;
  type: CaptureType;
  points: Point[];
}

interface GameState {
  board: (PieceType | null)[][];
  turn: PieceType;
  selected: Point | null;
  history: (PieceType | null)[][][];
  winner: PieceType | 'DRAW' | null;
  pendingCaptures: CaptureGroup[];
  isAiEnabled: boolean;
  difficulty: Difficulty;
}

const BOARD_SIZE = 5;

// Initial positions: 16 Soldiers, 1 Pig
const INITIAL_BOARD: (PieceType | null)[][] = Array(5).fill(null).map(() => Array(5).fill(null));

// Soldiers fill the perimeter (16 total)
for (let i = 0; i < 5; i++) {
  INITIAL_BOARD[0][i] = 'SOLDIER'; // Top
  INITIAL_BOARD[4][i] = 'SOLDIER'; // Bottom
}
for (let i = 1; i < 4; i++) {
  INITIAL_BOARD[i][0] = 'SOLDIER'; // Left
  INITIAL_BOARD[i][4] = 'SOLDIER'; // Right
}
// Pig at center
INITIAL_BOARD[2][2] = 'PIG';

export const LaoZhuQi: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    board: INITIAL_BOARD,
    turn: 'PIG', 
    selected: null,
    history: [],
    winner: null,
    pendingCaptures: [],
    isAiEnabled: true,
    difficulty: 'MEDIUM',
  });
  const [selectedForCapture, setSelectedForCapture] = useState<Point[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // AI Logic for Soldiers
  useEffect(() => {
    if (gameState.isAiEnabled && gameState.turn === 'SOLDIER' && !gameState.winner && !isAiThinking) {
      const timer = setTimeout(() => {
        makeAiMove();
      }, 800); // Small delay to make it feel natural
      return () => clearTimeout(timer);
    }
  }, [gameState.turn, gameState.winner, gameState.isAiEnabled, isAiThinking]);

  const makeAiMove = () => {
    setIsAiThinking(true);
    
    const board = gameState.board;
    const soldiers: Point[] = [];
    let pigPos: Point = { x: 2, y: 2 };

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (board[y][x] === 'SOLDIER') soldiers.push({ x, y });
        if (board[y][x] === 'PIG') pigPos = { x, y };
      }
    }

    let bestMove: { from: Point; to: Point } | null = null;

    if (gameState.difficulty === 'EASY') {
      const allPossibleMoves: { from: Point; to: Point }[] = [];
      for (const soldier of soldiers) {
        const moves = getValidMoves(soldier, board);
        moves.forEach(m => allPossibleMoves.push({ from: soldier, to: m }));
      }
      if (allPossibleMoves.length > 0) {
        bestMove = allPossibleMoves[Math.floor(Math.random() * allPossibleMoves.length)];
      }
    } else if (gameState.difficulty === 'MEDIUM') {
      let maxScore = -Infinity;
      for (const soldier of soldiers) {
        const moves = getValidMoves(soldier, board);
        for (const move of moves) {
          const newBoard = board.map(row => [...row]);
          newBoard[move.y][move.x] = 'SOLDIER';
          newBoard[soldier.y][soldier.x] = null;

          let score = evaluateBoard(newBoard, pigPos, 'MEDIUM');
          if (score > maxScore) {
            maxScore = score;
            bestMove = { from: soldier, to: move };
          }
        }
      }
    } else {
      // HARD: Minimax with depth 3
      let result = minimax(board, pigPos, 3, true, -Infinity, Infinity);
      bestMove = result.move;
    }

    if (bestMove) {
      const newBoard = board.map(row => [...row]);
      newBoard[bestMove.to.y][bestMove.to.x] = 'SOLDIER';
      newBoard[bestMove.from.y][bestMove.from.x] = null;
      
      checkGameStatus(newBoard, 'PIG');
    }
    
    setIsAiThinking(false);
  };

  const evaluateBoard = (board: (PieceType | null)[][], pigPos: Point, difficulty: Difficulty): number => {
    let score = 0;
    const soldierCount = board.flat().filter(p => p === 'SOLDIER').length;

    // 1. Distance to Pig
    const dist = Math.sqrt(Math.pow(2 - pigPos.x, 2) + Math.pow(2 - pigPos.y, 2)); // Center distance
    const distToPig = board.reduce((acc, row, y) => {
      row.forEach((p, x) => {
        if (p === 'SOLDIER') {
          acc += Math.sqrt(Math.pow(x - pigPos.x, 2) + Math.pow(y - pigPos.y, 2));
        }
      });
      return acc;
    }, 0) / soldierCount;
    score -= distToPig * 5;

    // 2. Pig's mobility
    const pigMoves = getValidMoves(pigPos, board);
    score += (8 - pigMoves.length) * 15;

    // 3. Safety Check: If this move allows the Pig to capture pieces, heavily penalize it
    const potentialCaptures = findCaptures(pigPos, board);
    if (potentialCaptures.length > 0) {
      const totalCaptureCount = potentialCaptures.reduce((acc, g) => acc + g.points.length, 0);
      score -= totalCaptureCount * 100;
    }

    // 4. Soldier clustering (encircle pig)
    if (difficulty === 'HARD') {
        const avgX = board.reduce((acc, row, y) => acc + row.reduce((sa, p, x) => p === 'SOLDIER' ? sa + x : sa, 0), 0) / soldierCount;
        const avgY = board.reduce((acc, row, y) => acc + row.reduce((sa, p, x) => p === 'SOLDIER' ? sa + y : sa, 0), 0) / soldierCount;
        const alignment = Math.sqrt(Math.pow(avgX - pigPos.x, 2) + Math.pow(avgY - pigPos.y, 2));
        score -= alignment * 10;
        
        // Bonus for cornering
        if (pigMoves.length <= 1) score += 500;
        if (pigMoves.length === 0) score += 10000;
    }

    return score + Math.random() * 0.5;
  };

  const minimax = (
    board: (PieceType | null)[][], 
    pigPos: Point, 
    depth: number, 
    isMaximizing: boolean,
    alpha: number,
    beta: number
  ): { score: number; move: { from: Point; to: Point } | null } => {
    // Check terminal states
    let soldierCount = 0;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (board[y][x] === 'SOLDIER') soldierCount++;
      }
    }

    const pigMoves = getValidMoves(pigPos, board);
    if (soldierCount <= 2) return { score: -100000, move: null };
    if (pigMoves.length === 0) return { score: 100000, move: null };
    if (depth === 0) return { score: evaluateBoard(board, pigPos, 'HARD'), move: null };

    if (isMaximizing) {
      let maxEval = -Infinity;
      let bestMove: { from: Point; to: Point } | null = null;
      
      const soldiers: Point[] = [];
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          if (board[y][x] === 'SOLDIER') soldiers.push({ x, y });
        }
      }

      for (const soldier of soldiers) {
        const moves = getValidMoves(soldier, board);
        for (const move of moves) {
          const newBoard = board.map(row => [...row]);
          newBoard[move.y][move.x] = 'SOLDIER';
          newBoard[soldier.y][soldier.x] = null;
          
          // Detect if Pig would move next or wait for capture resolution?
          // For simplicity in minimax, assume Pig just moves next
          const nextEval = minimax(newBoard, pigPos, depth - 1, false, alpha, beta).score;
          if (nextEval > maxEval) {
            maxEval = nextEval;
            bestMove = { from: soldier, to: move };
          }
          alpha = Math.max(alpha, nextEval);
          if (beta <= alpha) break;
        }
        if (beta <= alpha) break;
      }
      return { score: maxEval, move: bestMove };
    } else {
      let minEval = Infinity;
      const moves = getValidMoves(pigPos, board);
      
      for (const move of moves) {
        const newBoard = board.map(row => [...row]);
        newBoard[move.y][move.x] = 'PIG';
        newBoard[pigPos.y][pigPos.x] = null;

        // Check for captures
        const captures = findCaptures(move, newBoard);
        if (captures.length > 0) {
            // Assume pig eats everything for eval
            captures.flatMap(g => g.points).forEach(p => {
                newBoard[p.y][p.x] = null;
            });
        }

        const nextEval = minimax(newBoard, move, depth - 1, true, alpha, beta).score;
        minEval = Math.min(minEval, nextEval);
        beta = Math.min(beta, nextEval);
        if (beta <= alpha) break;
      }
      return { score: minEval, move: null };
    }
  };

  const isValidPos = (x: number, y: number) => x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;

  const isConnected = (p1: Point, p2: Point) => {
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);
    // Vertical/Horizontal
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) return true;
    // Diagonals exist ONLY between two points that both have even coordinate sums
    if (dx === 1 && dy === 1 && (p1.x + p1.y) % 2 === 0 && (p2.x + p2.y) % 2 === 0) return true;
    return false;
  };

  const getValidMoves = (p: Point, board: (PieceType | null)[][]) => {
    const moves: Point[] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (!board[y][x] && isConnected(p, { x, y })) {
          moves.push({ x, y });
        }
      }
    }
    return moves;
  };

  const findCaptures = (pigPos: Point, board: (PieceType | null)[][]): CaptureGroup[] => {
    const groups: CaptureGroup[] = [];

    // 1. Vertex capture (对角吃)
    const corners = [
      { s: { x: 0, y: 0 }, p: { x: 1, y: 1 } },
      { s: { x: 4, y: 0 }, p: { x: 3, y: 1 } },
      { s: { x: 0, y: 4 }, p: { x: 1, y: 3 } },
      { s: { x: 4, y: 4 }, p: { x: 3, y: 3 } },
    ];
    corners.forEach((pair, i) => {
      if (pigPos.x === pair.p.x && pigPos.y === pair.p.y) {
        if (board[pair.s.y][pair.s.x] === 'SOLDIER' && isConnected(pigPos, pair.s)) {
          groups.push({
            id: `vertex-${i}`,
            type: 'VERTEX',
            points: [pair.s]
          });
        }
      }
    });

    // 2. Shouldering (对挑 S-P-S)
    const directions = [
      { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }
    ];
    directions.forEach((d, i) => {
      const p1 = { x: pigPos.x + d.dx, y: pigPos.y + d.dy };
      const p2 = { x: pigPos.x - d.dx, y: pigPos.y - d.dy };
      if (isValidPos(p1.x, p1.y) && isValidPos(p2.x, p2.y)) {
        if (board[p1.y][p1.x] === 'SOLDIER' && board[p2.y][p2.x] === 'SOLDIER') {
          if (isConnected(pigPos, p1) && isConnected(pigPos, p2)) {
            groups.push({
              id: `shoulder-${i}`,
              type: 'SHOULDER',
              points: [p1, p2]
            });
          }
        }
      }
    });

    // 3. Five-in-a-row (扫射 P-S-S-S-S)
    directions.forEach((d, i) => {
      const checkLine = (dir: { dx: number, dy: number }, idPrefix: string) => {
        const line: Point[] = [];
        let cur = pigPos;
        for (let j = 1; j <= 4; j++) {
          const next = { x: pigPos.x + dir.dx * j, y: pigPos.y + dir.dy * j };
          if (isValidPos(next.x, next.y) && board[next.y][next.x] === 'SOLDIER' && isConnected(cur, next)) {
            line.push(next);
            cur = next;
          } else break;
        }
        if (line.length === 4) {
          groups.push({
            id: `${idPrefix}-${i}`,
            type: 'FIVELINE',
            points: [...line]
          });
        }
      };
      
      checkLine(d, 'fiveline-f');
      checkLine({ dx: -d.dx, dy: -d.dy }, 'fiveline-b');
    });

    return groups;
  };

  const handleCellClick = (x: number, y: number) => {
    if (gameState.winner || isAiThinking) return;
    
    // Prevent interaction during AI turn (Soldier) if AI enabled
    if (gameState.isAiEnabled && gameState.turn === 'SOLDIER') return;

    // Handle selecting/deselecting pieces during capture phase
    if (gameState.pendingCaptures.length > 0) {
      const allPoints = gameState.pendingCaptures.flatMap(g => g.points);
      const isPending = allPoints.some(p => p.x === x && p.y === y);
      
      if (isPending) {
        // Find if this point is currently selected
        const isSelected = selectedForCapture.some(p => p.x === x && p.y === y);
        
        if (isSelected) {
          // Deselect point
          setSelectedForCapture(prev => prev.filter(p => !(p.x === x && p.y === y)));
        } else {
          // Select point
          setSelectedForCapture(prev => [...prev, { x, y }]);
        }
      }
      return;
    }

    const p = { x, y };
    const currentPiece = gameState.board[y][x];

    if (currentPiece === gameState.turn) {
      setGameState(prev => ({ ...prev, selected: p }));
    } else if (gameState.selected && !currentPiece) {
      if (isConnected(gameState.selected, p)) {
        const newBoard = gameState.board.map(row => [...row]);
        newBoard[p.y][p.x] = gameState.turn;
        newBoard[gameState.selected.y][gameState.selected.x] = null;

        if (gameState.turn === 'PIG') {
          const groups = findCaptures(p, newBoard);
          if (groups.length > 0) {
            setGameState(prev => ({
              ...prev,
              board: newBoard,
              selected: null,
              pendingCaptures: groups,
            }));
            // Default to eating everything in all groups
            const allPoints = groups.flatMap(g => g.points);
            // Unique points only
            const uniquePoints = allPoints.filter((p, index, self) => 
              self.findIndex(t => t.x === p.x && t.y === p.y) === index
            );
            setSelectedForCapture(uniquePoints);
            return;
          }
        }

        // Switch turn if no captures triggered
        const nextTurn = gameState.turn === 'PIG' ? 'SOLDIER' : 'PIG';
        checkGameStatus(newBoard, nextTurn);
      }
    }
  };

  const checkGameStatus = (board: (PieceType | null)[][], nextTurn: PieceType) => {
    let soldierCount = 0;
    let pigPos: Point | null = null;
    
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (board[y][x] === 'SOLDIER') soldierCount++;
        if (board[y][x] === 'PIG') pigPos = { x, y };
      }
    }

    let winner: PieceType | 'DRAW' | null = null;

    if (soldierCount <= 2) {
      winner = 'PIG';
    } else if (pigPos) {
      const pigMoves = getValidMoves(pigPos, board);
      if (pigMoves.length === 0 && nextTurn === 'PIG') {
        winner = 'SOLDIER';
      }
    }

    setGameState(prev => ({
      ...prev,
      board,
      turn: nextTurn,
      selected: null,
      winner,
      history: [...prev.history, prev.board],
    }));
  };

  const resolveCapture = (confirm: boolean) => {
    const newBoard = gameState.board.map(row => [...row]);
    if (confirm) {
      selectedForCapture.forEach(p => {
        newBoard[p.y][p.x] = null;
      });
    }

    setGameState(prev => ({ ...prev, pendingCaptures: [] }));
    setSelectedForCapture([]);
    checkGameStatus(newBoard, 'SOLDIER'); // After Pig eats (or doesn't), it's Soldiers' turn
  };

  const resetGame = () => {
    setGameState({
      board: INITIAL_BOARD,
      turn: 'PIG', 
      selected: null,
      history: [],
      winner: null,
      pendingCaptures: [],
      isAiEnabled: gameState.isAiEnabled,
      difficulty: gameState.difficulty,
    });
    setSelectedForCapture([]);
  };

  const undoMove = () => {
    if (gameState.history.length === 0 || gameState.winner || isAiThinking) return;
    
    // In AI mode, undo twice to go back to the player's last turn
    const historyStep = gameState.isAiEnabled ? 2 : 1;
    const historyIndex = Math.max(0, gameState.history.length - historyStep);
    const targetBoard = gameState.history[historyIndex];
    
    setGameState(prev => ({
      ...prev,
      board: targetBoard,
      turn: 'PIG', // Back to player turn in AI mode
      history: prev.history.slice(0, historyIndex),
      selected: null,
      pendingCaptures: [],
      winner: null,
    }));
    setSelectedForCapture([]);
  };

  const toggleAi = () => {
    setGameState(prev => ({ ...prev, isAiEnabled: !prev.isAiEnabled }));
  };

  const setDifficulty = (diff: Difficulty) => {
    setGameState(prev => ({ ...prev, difficulty: diff }));
  };

  const soldierCount = gameState.board.flat().filter(p => p === 'SOLDIER').length;

  const handleDraw = () => {
    setGameState(prev => ({ ...prev, winner: 'DRAW' }));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] p-4 text-zinc-100 font-sans">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
          老猪棋
        </h1>
        <p className="text-zinc-400 text-sm font-medium">Lao Zhu Qi - Old Pig Chess</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center w-full max-w-5xl">
        {/* Game Board Container */}
        <div className="relative p-4 sm:p-6 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Sizing wrapper to keep board square */}
          <div className="relative w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] md:w-[480px] md:h-[480px]">
            <BoardBackground />
            
            {/* Interactive Intersections */}
            <div className="absolute inset-0">
              {gameState.board.map((row, y) =>
                row.map((piece, x) => {
                  // Coordinate mapping: 10%, 30%, 50%, 70%, 90%
                  const left = `${x * 20 + 10}%`;
                  const top = `${y * 20 + 10}%`;
                  
                  return (
                    <div
                      key={`cell-${x}-${y}`}
                      onClick={() => handleCellClick(x, y)}
                      style={{ left, top }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-[18%] h-[18%] flex items-center justify-center cursor-pointer z-20 group"
                    >
                      {/* Valid move indicator */}
                      {gameState.selected && !piece && isConnected(gameState.selected, { x, y }) && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute w-3 h-3 bg-blue-500/40 rounded-full z-0 group-hover:bg-blue-500/60 transition-colors"
                        />
                      )}

                      {/* Piece */}
                      <AnimatePresence mode="popLayout">
                        {piece && (
                          <motion.div
                            layoutId={`piece-${piece}-${x}-${y}`}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ 
                              scale: 1, 
                              opacity: 1,
                              filter: gameState.selected?.x === x && gameState.selected?.y === y ? 'drop-shadow(0 0 12px rgba(59, 130, 246, 0.6))' : 'none'
                            }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            className={cn(
                              "relative z-10 w-full h-full rounded-full flex items-center justify-center shadow-xl transition-all duration-300",
                              piece === 'PIG' 
                                ? "bg-gradient-to-br from-pink-500 via-rose-600 to-rose-700 border-2 border-pink-400/50" 
                                : "bg-gradient-to-br from-zinc-100 via-zinc-300 to-zinc-500 border-2 border-white/60 scale-75",
                              gameState.selected?.x === x && gameState.selected?.y === y && "scale-110 ring-4 ring-blue-500/30"
                            )}
                          >
                            {piece === 'PIG' ? (
                              <LucideGhost className="w-1/2 h-1/2 text-white drop-shadow-md" strokeWidth={2.5} />
                            ) : (
                              <div className="w-2/3 h-2/3 rounded-full bg-zinc-800/20 backdrop-blur-sm border border-black/10 flex items-center justify-center text-[min(2.5vw,16px)] font-black text-zinc-900 leading-none">
                                卒
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Capture Overlay */}
                      {(() => {
                        const allCapturePoints = gameState.pendingCaptures.flatMap(g => g.points);
                        const isCaptured = allCapturePoints.some(cp => cp.x === x && cp.y === y);
                        if (!isCaptured) return null;

                        const isSelected = selectedForCapture.some(sp => sp.x === x && sp.y === y);
                        
                        return (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ 
                              scale: isSelected ? 1.3 : 1.1, 
                              opacity: 1 
                            }}
                            className={cn(
                              "absolute inset-0 rounded-full z-30 border-2 transition-colors duration-200 flex items-center justify-center",
                              isSelected 
                                ? "bg-rose-500/40 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]" 
                                : "bg-zinc-500/20 border-zinc-500/50"
                            )}
                          >
                            {isSelected && (
                              <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                            )}
                          </motion.div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="flex flex-col gap-6 w-full lg:w-72">
          {/* Status Card */}
          <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4 shadow-xl">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <LucideScale className="w-4 h-4" />
              Game Status
            </h2>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-3 h-3 rounded-full animate-pulse",
                  gameState.turn === 'PIG' ? "bg-pink-500" : "bg-zinc-100"
                )} />
                <span className="text-xl font-bold">
                  {gameState.turn === 'PIG' ? '猪之回合' : '卒之回合'}
                </span>
              </div>
            </div>

            {gameState.winner && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-3 text-blue-400"
              >
                <LucideTrophy className="w-6 h-6 flex-shrink-0" />
                <div className="font-bold">
                  {gameState.winner === 'PIG' ? '猪获胜了！' : gameState.winner === 'SOLDIER' ? '卒获胜了！' : '双方和棋'}
                </div>
              </motion.div>
            )}

            {gameState.pendingCaptures.length > 0 && (
              <div className="space-y-4">
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                  <p className="text-[11px] text-rose-300 font-medium leading-relaxed">
                    检测到吃子机会！可按组选择或单独点击卒。
                  </p>
                </div>

                {/* Group Select Buttons */}
                <div className="grid grid-cols-1 gap-2">
                  {gameState.pendingCaptures.map((group, idx) => {
                    const isAllSelected = group.points.every(gp => 
                      selectedForCapture.some(sp => sp.x === gp.x && sp.y === gp.y)
                    );
                    
                    const groupNames = {
                      'VERTEX': '对角吃',
                      'SHOULDER': '对挑',
                      'FIVELINE': '五连扫'
                    };

                    return (
                      <button
                        key={group.id}
                        onClick={() => {
                          if (isAllSelected) {
                            // Deselect these points
                            const idsToRemove = group.points.map(p => `${p.x},${p.y}`);
                            setSelectedForCapture(prev => prev.filter(p => !idsToRemove.includes(`${p.x},${p.y}`)));
                          } else {
                            // Select these points (add missing ones)
                            setSelectedForCapture(prev => {
                                const newOnes = group.points.filter(gp => !prev.some(sp => sp.x === gp.x && sp.y === gp.y));
                                return [...prev, ...newOnes];
                            });
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 text-[10px] font-bold rounded-lg transition-all border",
                          isAllSelected 
                            ? "bg-rose-500/20 border-rose-500/50 text-rose-300" 
                            : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        <span>{groupNames[group.type]} ({group.points.length}卒)</span>
                        {isAllSelected ? "已选" : "选择"}
                      </button>
                    );
                  })}
                  
                  {gameState.pendingCaptures.length > 1 && (
                     <button
                     onClick={() => {
                        const allPoints = gameState.pendingCaptures.flatMap(g => g.points);
                        const unique = allPoints.filter((p, index, self) => 
                          self.findIndex(t => t.x === p.x && t.y === p.y) === index
                        );
                        setSelectedForCapture(unique);
                     }}
                     className="py-1 text-[10px] text-zinc-500 hover:text-rose-400 transition-colors underline decoration-dotted"
                   >
                     全选所有组
                   </button>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => resolveCapture(true)}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/20 transition-all text-sm active:scale-95"
                  >
                    确认吃掉 ({selectedForCapture.length})
                  </button>
                  <button
                    onClick={() => resolveCapture(false)}
                    className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all text-sm active:scale-95"
                  >
                    全部放弃
                  </button>
                </div>
              </div>
            )}

            {soldierCount <= 4 && !gameState.winner && (
              <button
                onClick={handleDraw}
                className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 font-bold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                提出和棋
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={undoMove}
              disabled={gameState.history.length === 0 || !!gameState.winner || isAiThinking}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 font-bold rounded-xl transition-all"
            >
              <LucideRotateCcw className="w-4 h-4" />
              悔棋
            </button>
            <button
              onClick={resetGame}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl transition-all"
            >
              重开
            </button>
          </div>

          <button
            onClick={toggleAi}
            className={cn(
              "w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-black text-sm tracking-tight transition-all relative overflow-hidden group",
              gameState.isAiEnabled 
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" 
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            )}
          >
            <div className={cn(
              "absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full transition-transform duration-1000",
              gameState.isAiEnabled && "animate-shimmer"
            )} />
            <LucideUser className={cn("w-5 h-5", gameState.isAiEnabled ? "hidden" : "block")} />
            <div className={cn("w-5 h-5 flex items-center justify-center", !gameState.isAiEnabled ? "hidden" : "block")}>
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
            </div>
            {gameState.isAiEnabled ? "AI 对抗模式: 已开启" : "双人本地对战模式"}
          </button>

          {gameState.isAiEnabled && (
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">AI 难度等级</h3>
              <div className="grid grid-cols-3 gap-2">
                {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "py-2 text-[10px] font-bold rounded-lg transition-all border",
                      gameState.difficulty === d
                        ? "bg-blue-500/20 border-blue-500 text-blue-400"
                        : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {d === 'EASY' ? '简单' : d === 'MEDIUM' ? '中等' : '困难'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rules Summary */}
          <div className="p-4 border border-zinc-800/50 rounded-2xl bg-zinc-900/30">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">棋规概要</h3>
            <ul className="text-[11px] text-zinc-500 space-y-1.5 leading-relaxed">
              <li>• 猪吃卒：对角吃、对挑、扫射(五连)</li>
              <li>• 猪胜：卒减少到2个</li>
              <li>• 卒胜：困死猪(无路可走)</li>
              <li>• 每回合均只能沿线走一步</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const BoardBackground: React.FC = () => {
    return (
        <svg 
            className="absolute inset-0 w-full h-full text-zinc-700 pointer-events-none"
            viewBox="0 0 500 500"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
        >
            {/* Grid Lines */}
            {Array.from({ length: 5 }).map((_, i) => {
                const pos = 50 + i * 100;
                return (
                    <React.Fragment key={i}>
                        <line x1={pos} y1="50" x2={pos} y2="450" className="text-zinc-600/80" />
                        <line x1="50" y1={pos} x2="450" y2={pos} className="text-zinc-600/80" />
                    </React.Fragment>
                );
            })}

            {/* Diagonals: each 1x1 cell has exactly one diagonal with both even-sum endpoints */}
            {Array.from({ length: 4 }).map((_, y) => (
                Array.from({ length: 4 }).map((_, x) => {
                    const x1 = 50 + x * 100;
                    const y1 = 50 + y * 100;
                    const x2 = x1 + 100;
                    const y2 = y1 + 100;
                    
                    const isEven = (x + y) % 2 === 0;

                    return isEven ? (
                        <line key={`d-even-${x}-${y}`} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="2" className="text-zinc-600/60" />
                    ) : (
                        <line key={`d-odd-${x}-${y}`} x1={x2} y1={y1} x2={x1} y2={y2} strokeWidth="2" className="text-zinc-600/60" />
                    );
                })
            ))}
        </svg>
    );
}

export default LaoZhuQi;
