import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Mode = 'keep' | 'erase'
type Difficulty = 'easy' | 'medium' | 'hard'

type Point = { r: number; c: number }

type Group = {
  id: string
  label: string
  color: string
  cells: Point[]
  target: number
}

type Puzzle = {
  rows: number
  cols: number
  grid: number[][]
  rowTargets: number[]
  colTargets: number[]
  groups: Group[]
  solution: boolean[][]
}

type CellState = 'unknown' | 'keep' | 'erase'

type SaveData = {
  puzzle: Puzzle
  difficulty: Difficulty
  cellStates: CellState[][]
  mode: Mode
  lives: number
}

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

const DIRECTIONS: Point[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
]

const inBounds = (r: number, c: number, rows: number, cols: number) => r >= 0 && r < rows && c >= 0 && c < cols

const createState = (rows: number, cols: number): CellState[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'unknown' as CellState))

const getGroupMap = (groups: Group[]) => {
  const map = new Map<string, Group>()
  groups.forEach((g) => g.cells.forEach((cell) => map.set(`${cell.r},${cell.c}`, g)))
  return map
}

const getTopLeftGroupCells = (groups: Group[]) => {
  const map = new Map<string, Point>()
  groups.forEach((group) => {
    const topLeft = [...group.cells].sort((a, b) => (a.r - b.r) || (a.c - b.c))[0]
    map.set(group.id, topLeft)
  })
  return map
}

const makeContiguousGroups = (rows: number, cols: number): Group[] => {
  const total = rows * cols
  const cellIds = Array.from({ length: total }, (_, i) => ({ r: Math.floor(i / cols), c: i % cols }))
  const unassigned = new Set(cellIds.map((p) => `${p.r},${p.c}`))
  const groups: Group[] = []
  const groupCount = Math.max(2, Math.min(5, Math.floor(total / 8)))

  const pickUnassigned = (): Point => {
    const items = Array.from(unassigned)
    const key = items[randomInt(0, items.length - 1)]
    const [r, c] = key.split(',').map(Number)
    return { r, c }
  }

  for (let gi = 0; gi < groupCount && unassigned.size > 0; gi++) {
    const targetSize = Math.min(unassigned.size, 2 + randomInt(0, 3))
    const seed = pickUnassigned()
    const groupCells: Point[] = [seed]
    unassigned.delete(`${seed.r},${seed.c}`)

    while (groupCells.length < targetSize) {
      const candidates: Point[] = []
      groupCells.forEach((cell) => {
        DIRECTIONS.forEach((d) => {
          const nr = cell.r + d.r
          const nc = cell.c + d.c
          const key = `${nr},${nc}`
          if (inBounds(nr, nc, rows, cols) && unassigned.has(key)) candidates.push({ r: nr, c: nc })
        })
      })

      if (candidates.length === 0) break
      const choice = candidates[randomInt(0, candidates.length - 1)]
      const key = `${choice.r},${choice.c}`
      if (!unassigned.has(key)) break
      groupCells.push(choice)
      unassigned.delete(key)
    }

    groups.push({
      id: `${gi}`,
      label: String.fromCharCode(65 + gi),
      color: ['#f87171', '#60a5fa', '#34d399', '#eab308', '#a78bfa'][gi % 5],
      target: 0,
      cells: groupCells,
    })
  }

  if (unassigned.size > 0) {
    const unassignedCells = Array.from(unassigned).map((key) => {
      const [r, c] = key.split(',').map(Number)
      return { r, c }
    })
    unassignedCells.forEach((cell) => {
      const group = groups[randomInt(0, groups.length - 1)]
      group.cells.push(cell)
    })
    unassigned.clear()
  }

  return groups
}

const countSolutions = (puzzle: Puzzle, maxCount = 2): number => {
  const { rows, cols, grid, rowTargets, colTargets, groups } = puzzle
  const total = rows * cols
  const cellOrder: Point[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cellOrder.push({ r, c })
  }

  const groupIndex = Array.from({ length: rows }, () => Array(cols).fill(-1))
  const groupSizes = groups.map((g) => g.cells.length)
  groups.forEach((group, gi) => group.cells.forEach((cell) => (groupIndex[cell.r][cell.c] = gi)))

  const rowRemaining = Array.from({ length: rows }, () => Array(total + 1).fill(0))
  const colRemaining = Array.from({ length: cols }, () => Array(total + 1).fill(0))
  const groupRemaining = Array.from({ length: groups.length }, () => Array(total + 1).fill(0))

  for (let idx = total - 1; idx >= 0; idx--) {
    const { r, c } = cellOrder[idx]
    const val = grid[r][c]
    const gi = groupIndex[r][c]

    for (let rr = 0; rr < rows; rr++) {
      rowRemaining[rr][idx] = rowRemaining[rr][idx + 1] + (rr === r ? val : 0)
    }
    for (let cc = 0; cc < cols; cc++) {
      colRemaining[cc][idx] = colRemaining[cc][idx + 1] + (cc === c ? val : 0)
    }
    for (let g = 0; g < groups.length; g++) {
      groupRemaining[g][idx] = groupRemaining[g][idx + 1] + (g === gi ? val : 0)
    }
  }

  let solutions = 0

  const rowSum = Array(rows).fill(0)
  const colSum = Array(cols).fill(0)
  const groupSum = Array(groups.length).fill(0)
  const rowAssigned = Array(rows).fill(0)
  const colAssigned = Array(cols).fill(0)
  const groupAssigned = Array(groups.length).fill(0)

  const dfs = (idx: number) => {
    if (solutions >= maxCount) return
    if (idx === total) {
      const allMatch =
        rowSum.every((v, r) => v === rowTargets[r]) &&
        colSum.every((v, c) => v === colTargets[c]) &&
        groupSum.every((v, g) => v === groups[g].target)
      if (allMatch) solutions += 1
      return
    }

    const { r, c } = cellOrder[idx]
    const val = grid[r][c]
    const gi = groupIndex[r][c]

    for (const choice of [0, 1]) {
      const newRow = rowSum[r] + choice * val
      const newCol = colSum[c] + choice * val
      const newGroup = groupSum[gi] + choice * val

      if (newRow > rowTargets[r] || newCol > colTargets[c] || newGroup > groups[gi].target) continue

      const rowRem = rowRemaining[r][idx + 1]
      const colRem = colRemaining[c][idx + 1]
      const groupRem = groupRemaining[gi][idx + 1]

      if (newRow + rowRem < rowTargets[r]) continue
      if (newCol + colRem < colTargets[c]) continue
      if (newGroup + groupRem < groups[gi].target) continue

      rowSum[r] = newRow
      colSum[c] = newCol
      groupSum[gi] = newGroup
      rowAssigned[r] += 1
      colAssigned[c] += 1
      groupAssigned[gi] += 1

      const isRowEnd = c === cols - 1
      const isColEnd = r === rows - 1
      const isGroupComplete = groupAssigned[gi] === groupSizes[gi]

      if ((isRowEnd && rowSum[r] !== rowTargets[r]) || (isColEnd && colSum[c] !== colTargets[c]) || (isGroupComplete && groupSum[gi] !== groups[gi].target)) {
        rowAssigned[r] -= 1
        colAssigned[c] -= 1
        groupAssigned[gi] -= 1
        rowSum[r] -= choice * val
        colSum[c] -= choice * val
        groupSum[gi] -= choice * val
        continue
      }

      dfs(idx + 1)

      rowAssigned[r] -= 1
      colAssigned[c] -= 1
      groupAssigned[gi] -= 1
      rowSum[r] -= choice * val
      colSum[c] -= choice * val
      groupSum[gi] -= choice * val

      if (solutions >= maxCount) return
    }
  }

  dfs(0)
  return solutions
}

const createPuzzle = (difficulty: Difficulty): Puzzle => {
  const sizeMap: Record<Difficulty, number> = { easy: 4, medium: 5, hard: 8 }
  const rows = sizeMap[difficulty]
  const cols = rows

  for (let attempt = 0; attempt < 64; attempt++) {
    const grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => randomInt(1, 9))
    )

    const solution = Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.random() < 0.45))

    for (let r = 0; r < rows; r++) {
      if (!solution[r].some(Boolean)) solution[r][randomInt(0, cols - 1)] = true
    }
    for (let c = 0; c < cols; c++) {
      if (!solution.some((row) => row[c])) solution[randomInt(0, rows - 1)][c] = true
    }

    const rowTargets = solution.map((row, r) => row.reduce((sum, keep, c) => sum + (keep ? grid[r][c] : 0), 0))
    const colTargets = Array.from({ length: cols }, (_, c) =>
      grid.reduce((sum, row, r) => sum + (solution[r][c] ? row[c] : 0), 0)
    )

    let groups = makeContiguousGroups(rows, cols)
    groups = groups.map((group) => ({
      ...group,
      target: group.cells.reduce((sum, { r, c }) => sum + (solution[r][c] ? grid[r][c] : 0), 0),
    }))

    const candidate: Puzzle = { rows, cols, grid, rowTargets, colTargets, groups, solution }
    if (countSolutions(candidate, 2) === 1) return candidate
  }

  // fallback fixed puzzle
  const fixedPuzzle: Puzzle = {
    rows: 5,
    cols: 5,
    grid: [
      [1, 2, 3, 4, 5],
      [5, 4, 3, 2, 1],
      [2, 2, 2, 2, 2],
      [1, 3, 5, 7, 9],
      [9, 7, 5, 3, 1],
    ],
    solution: [
      [true, true, true, false, false],
      [true, false, true, false, false],
      [false, true, true, true, false],
      [true, false, true, false, true],
      [false, false, true, false, true],
    ],
    rowTargets: [6, 8, 6, 15, 6],
    colTargets: [7, 4, 18, 2, 10],
    groups: [
      { id: 'A', label: 'A', color: '#f87171', target: 8, cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }] },
      { id: 'B', label: 'B', color: '#60a5fa', target: 14, cells: [{ r: 2, c: 2 }, { r: 2, c: 3 }, { r: 3, c: 2 }, { r: 4, c: 2 }] },
      { id: 'C', label: 'C', color: '#34d399', target: 10, cells: [{ r: 3, c: 4 }, { r: 4, c: 4 }] },
    ],
  }
  return fixedPuzzle
}

const loadSaveData = (): SaveData | null => {
  if (typeof window === 'undefined') return null
  try {
    const str = localStorage.getItem('number-sums-data')
    if (!str) return null
    const parsed = JSON.parse(str) as SaveData
    if (parsed?.puzzle && parsed?.cellStates) return parsed
  } catch {
    // ignore invalid
  }
  return null
}

function App() {
  const saved = loadSaveData()
  const [difficulty, setDifficulty] = useState<Difficulty>(saved?.difficulty ?? 'medium')
  const [puzzle, setPuzzle] = useState<Puzzle>(() => saved?.puzzle ?? createPuzzle(saved?.difficulty ?? 'medium'))
  const [cellStates, setCellStates] = useState<CellState[][]>(() =>
    saved?.cellStates ?? createState(puzzle.rows, puzzle.cols)
  )
  const [mode, setMode] = useState<Mode>(saved?.mode ?? 'keep')
  const [lives, setLives] = useState(saved?.lives ?? 3)
  const [flashCell, setFlashCell] = useState<Point | null>(null)

  useEffect(() => {
    if (!flashCell) return
    const timer = setTimeout(() => setFlashCell(null), 300)
    return () => clearTimeout(timer)
  }, [flashCell])

  useEffect(() => {
    const data: SaveData = {
      puzzle,
      difficulty,
      cellStates,
      mode,
      lives,
    }
    localStorage.setItem('number-sums-data', JSON.stringify(data))
  }, [puzzle, difficulty, cellStates, mode, lives])

  const groupMap = useMemo(() => getGroupMap(puzzle.groups), [puzzle.groups])
  const groupTopLeft = useMemo(() => getTopLeftGroupCells(puzzle.groups), [puzzle.groups])

  const rowSums = useMemo(
    () => puzzle.grid.map((row, r) => row.reduce((sum, value, c) => sum + (cellStates[r][c] === 'keep' ? value : 0), 0)),
    [puzzle.grid, cellStates]
  )

  const colSums = useMemo(
    () =>
      Array.from({ length: puzzle.cols }, (_, c) =>
        puzzle.grid.reduce((sum, row, r) => sum + (cellStates[r][c] === 'keep' ? row[c] : 0), 0)
      ),
    [puzzle.grid, cellStates, puzzle.cols]
  )

  const groupSums = useMemo(
    () =>
      puzzle.groups.map((group) =>
        group.cells.reduce((sum, { r, c }) => sum + (cellStates[r][c] === 'keep' ? puzzle.grid[r][c] : 0), 0)
      ),
    [puzzle.groups, puzzle.grid, cellStates]
  )

  const rowCompleted = rowSums.map((sum, r) => {
    const rowDecided = puzzle.grid[r].every((_, c) => cellStates[r][c] !== 'unknown')
    return rowDecided && sum === puzzle.rowTargets[r]
  })

  const colCompleted = colSums.map((sum, c) => {
    const colDecided = puzzle.grid.every((_, r) => cellStates[r][c] !== 'unknown')
    return colDecided && sum === puzzle.colTargets[c]
  })

  const groupCompleted = groupSums.map((sum, i) => {
    const group = puzzle.groups[i]
    const groupDecided = group.cells.every(({ r, c }) => cellStates[r][c] !== 'unknown')
    return groupDecided && sum === group.target
  })

  const solved = useMemo(() => rowCompleted.every(Boolean) && colCompleted.every(Boolean) && groupCompleted.every(Boolean), [rowCompleted, colCompleted, groupCompleted])

  const handleCellClick = (r: number, c: number) => {
    if (lives <= 0 || solved) return

    const expected = puzzle.solution[r][c] ? 'keep' : 'erase'
    const newState = mode

    if (newState === expected) {
      setCellStates((prev) => {
        const next = prev.map((row) => [...row])
        next[r][c] = newState
        return next
      })
    } else {
      const nextLives = Math.max(0, lives - 1)
      setLives(nextLives)
      setFlashCell({ r, c })
    }
  }

  const startPuzzle = (level: Difficulty) => {
    const nextPuzzle = createPuzzle(level)
    setDifficulty(level)
    setPuzzle(nextPuzzle)
    setCellStates(createState(nextPuzzle.rows, nextPuzzle.cols))
    setLives(3)
    setMode('keep')
  }

  const hearts = Array.from({ length: 3 }, (_, i) => (i < lives ? '❤️' : '🤍')).join(' ')
  const isGameOver = lives <= 0 || solved

  return (
    <div className="app-container">
      <header>
        <h1>Sum Numbers</h1>
      </header>

      <section className="status">
        <span className="lives">{hearts}</span>
      </section>

      {isGameOver ? (
        <section className="end-state">
          <h2>{solved ? '🎉 You Win!' : '💥 Game Over'}</h2>
          <p>{solved ? 'All targets matched!' : 'You have no lives left.'}</p>
          <button onClick={() => startPuzzle(difficulty)}>{solved ? 'Next Puzzle' : 'Restart'}</button>
        </section>
      ) : (
        <>
          <section className="puzzle-wrapper">
            <table className="puzzle-grid">
              <thead>
                <tr>
                  <th></th>
                  {puzzle.colTargets.map((target, c) => (
                    <th key={`col-${c}`} className={colCompleted[c] ? 'completed' : ''}>
                      {colCompleted[c] ? '✔' : target}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {puzzle.grid.map((row, r) => (
                  <tr key={`row-${r}`}>
                    <th className={rowCompleted[r] ? 'completed' : ''}>
                      {rowCompleted[r] ? '✔' : puzzle.rowTargets[r]}
                    </th>
                    {row.map((value, c) => {
                      const group = groupMap.get(`${r},${c}`)
                      const topLeft = groupTopLeft.get(group?.id ?? '')
                      const groupDone = group ? groupCompleted[Number(group.id)] : false
                      const relevant = group && !groupDone ? group.color : undefined
                      const state = cellStates[r][c]
                      const displayValue = state === 'erase' ? '' : value

                      const highlighted = flashCell?.r === r && flashCell?.c === c
                      return (
                        <td
                          key={`cell-${r}-${c}`}
                          className={`cell ${state} ${group ? 'group-cell' : 'plain'} ${highlighted ? 'flash' : ''} ${groupDone ? 'group-done' : ''}`}
                          style={relevant ? { backgroundColor: `${relevant}40` } : undefined}
                          onClick={() => handleCellClick(r, c)}
                        >
                          <span>{displayValue}</span>
                          {group && topLeft?.r === r && topLeft?.c === c && (
                            <span className="group-total">{group.target}</span>
                          )}
                          {state === 'keep' && <small>✔</small>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mode-toggle">
        <button className={mode === 'keep' ? 'active' : ''} onClick={() => setMode('keep')}>
          ✏️ Pencil
        </button>
        <button className={mode === 'erase' ? 'active' : ''} onClick={() => setMode('erase')}>
          🧽 Eraser
        </button>
      </section>

      <section className="guide">
        <h2>Gameplay</h2>
        <ul>
          <li>Pick a mode and tap a cell: Select keeps, Erase removes.</li>
          <li>Wrong choice costs a life. 3 lives total.</li>
          <li>Row, column, and group targets are shown around the grid.</li>
        </ul>
      </section>

      <section className="controls bottom-controls">
        <button onClick={() => startPuzzle(difficulty)}>New</button>
        <button onClick={() => startPuzzle('easy')}>Easy</button>
        <button onClick={() => startPuzzle('medium')}>Medium</button>
        <button onClick={() => startPuzzle('hard')}>Hard</button>
      </section>
        </>
      )}
    </div>
  )
}

export default App
