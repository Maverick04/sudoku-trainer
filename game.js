const sudokuModes = {
  seedling: { name: "5x5", size: 5, givens: { easy: 15, normal: 12, hard: 9 } },
  sprout: { name: "6x6", size: 6, givens: { easy: 22, normal: 17, hard: 13 }, boxRows: 2, boxCols: 3 },
  bloom: { name: "7x7", size: 7, givens: { easy: 30, normal: 23, hard: 18 } },
  fruit: { name: "8x8", size: 8, givens: { easy: 38, normal: 30, hard: 24 }, boxRows: 2, boxCols: 4 },
  master: { name: "9x9", size: 9, givens: { easy: 45, normal: 36, hard: 29 }, boxRows: 3, boxCols: 3 },
};

const difficultyLevels = {
  easy: "简单",
  normal: "中等",
  hard: "困难",
};

const recordKey = "sudoku-trainer-records-v1";
const maxStoredRecords = 500;

const state = {
  mode: "seedling",
  difficulty: "easy",
  puzzle: null,
  selected: null,
  level: 1,
  streak: 0,
  mistakes: 0,
  startedAt: Date.now(),
  timer: null,
};

const boardEl = document.querySelector("#board");
const padEl = document.querySelector("#numberPad");
const messageEl = document.querySelector("#message");
const levelText = document.querySelector("#levelText");
const timerText = document.querySelector("#timerText");
const streakText = document.querySelector("#streakText");
const bestRecordEl = document.querySelector("#bestRecord");
const recordListEl = document.querySelector("#recordList");

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function startPuzzle() {
  const config = currentConfig();
  state.puzzle = buildSudokuPuzzle(config);
  state.selected = state.puzzle.cells.findIndex((cell) => cell === 0);
  state.mistakes = 0;
  state.startedAt = Date.now();
  const boxText = config.boxRows ? `，每个 ${config.boxRows}x${config.boxCols} 小宫格也不能重复` : "";
  messageEl.textContent = `${config.name} ${difficultyLevels[state.difficulty]}：每行、每列都要有 1-${config.size}${boxText}。`;
  renderSudoku();
  renderRecords();
  tick();
}

function currentConfig() {
  const base = sudokuModes[state.mode];
  return {
    ...base,
    givens: base.givens[state.difficulty],
  };
}

function buildSudokuPuzzle(config) {
  const size = config.size;
  const nums = shuffle(Array.from({ length: size }, (_, index) => index + 1));
  const pattern = (row, col) => {
    if (config.boxRows && config.boxCols) {
      return (config.boxCols * (row % config.boxRows) + Math.floor(row / config.boxRows) + col) % size;
    }
    return (row + col) % size;
  };
  const rowOrder = config.boxRows
    ? shuffle(Array.from({ length: size / config.boxRows }, (_, band) => band)).flatMap((band) =>
        shuffle(Array.from({ length: config.boxRows }, (_, row) => band * config.boxRows + row)),
      )
    : shuffle(Array.from({ length: size }, (_, row) => row));
  const colOrder = config.boxCols
    ? shuffle(Array.from({ length: size / config.boxCols }, (_, band) => band)).flatMap((band) =>
        shuffle(Array.from({ length: config.boxCols }, (_, col) => band * config.boxCols + col)),
      )
    : shuffle(Array.from({ length: size }, (_, col) => col));
  const solution = rowOrder.flatMap((row) => colOrder.map((col) => nums[pattern(row, col)]));
  const fixed = digUniquePuzzle(solution, config);

  return {
    size,
    boxRows: config.boxRows,
    boxCols: config.boxCols,
    solution,
    cells: solution.map((value, index) => (fixed.has(index) ? value : 0)),
    fixed,
    entries: new Map(),
  };
}

function digUniquePuzzle(solution, config) {
  const size = config.size;
  const fixed = new Set(Array.from({ length: size * size }, (_, index) => index));
  const positions = shuffle([...fixed]);

  for (const index of positions) {
    if (fixed.size <= config.givens) break;
    fixed.delete(index);
    if (countSolutions(solution, fixed, config, 2) !== 1) fixed.add(index);
  }

  return fixed;
}

function countSolutions(solution, fixed, config, limit) {
  const size = config.size;
  const grid = solution.map((value, index) => (fixed.has(index) ? value : 0));
  let count = 0;

  function candidatesFor(index) {
    const row = Math.floor(index / size);
    const col = index % size;
    const used = new Set();

    for (let currentCol = 0; currentCol < size; currentCol += 1) used.add(grid[row * size + currentCol]);
    for (let currentRow = 0; currentRow < size; currentRow += 1) used.add(grid[currentRow * size + col]);

    if (config.boxRows && config.boxCols) {
      const boxStartRow = Math.floor(row / config.boxRows) * config.boxRows;
      const boxStartCol = Math.floor(col / config.boxCols) * config.boxCols;
      for (let r = boxStartRow; r < boxStartRow + config.boxRows; r += 1) {
        for (let c = boxStartCol; c < boxStartCol + config.boxCols; c += 1) used.add(grid[r * size + c]);
      }
    }

    return Array.from({ length: size }, (_, value) => value + 1).filter((value) => !used.has(value));
  }

  function solve() {
    if (count >= limit) return;
    let bestIndex = -1;
    let bestCandidates = null;

    for (let index = 0; index < grid.length; index += 1) {
      if (grid[index] !== 0) continue;
      const candidates = candidatesFor(index);
      if (candidates.length === 0) return;
      if (!bestCandidates || candidates.length < bestCandidates.length) {
        bestIndex = index;
        bestCandidates = candidates;
        if (candidates.length === 1) break;
      }
    }

    if (bestIndex === -1) {
      count += 1;
      return;
    }

    for (const value of bestCandidates) {
      grid[bestIndex] = value;
      solve();
      grid[bestIndex] = 0;
      if (count >= limit) return;
    }
  }

  solve();
  return count;
}

function renderSudoku() {
  const size = state.puzzle.size;
  boardEl.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
  boardEl.style.setProperty("--sudoku-size", size);
  boardEl.style.setProperty("--board-max", `${size * 54 + (size - 1) * 8 + 16}px`);
  boardEl.dataset.size = size;
  boardEl.innerHTML = "";

  for (let index = 0; index < size * size; index += 1) {
    const fixed = state.puzzle.fixed.has(index);
    const value = fixed ? state.puzzle.cells[index] : state.puzzle.entries.get(index) || "";
    const cell = makeButton("cell sudoku-cell", value);
    const row = Math.floor(index / size);
    const col = index % size;
    cell.dataset.index = index;
    cell.setAttribute("aria-label", `第 ${row + 1} 行第 ${col + 1} 列${value ? `，${value}` : "，空格"}`);
    if (state.puzzle.boxCols && (col + 1) % state.puzzle.boxCols === 0 && col < size - 1) cell.classList.add("box-right");
    if (state.puzzle.boxRows && (row + 1) % state.puzzle.boxRows === 0 && row < size - 1) cell.classList.add("box-bottom");
    if (fixed) {
      cell.classList.add("fixed");
      cell.disabled = true;
    } else {
      cell.classList.add("empty");
      if (state.selected === index) cell.classList.add("selected");
      cell.addEventListener("click", () => selectCell(index));
    }
    boardEl.appendChild(cell);
  }

  renderPad(size);
  syncStats();
}

function renderPad(max) {
  padEl.innerHTML = "";
  padEl.dataset.max = max;
  for (let value = 1; value <= max; value += 1) {
    const button = makeButton("", value);
    button.addEventListener("click", () => enterValue(value));
    padEl.appendChild(button);
  }
  const clear = makeButton("", "清");
  clear.addEventListener("click", () => enterValue(null));
  padEl.appendChild(clear);
}

function makeButton(className, text) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  return button;
}

function selectCell(index) {
  if (state.puzzle.fixed.has(index)) return;
  state.selected = index;
  renderSudoku();
}

function enterValue(value) {
  if (state.selected === null || state.puzzle.fixed.has(state.selected)) {
    messageEl.textContent = "先点一个空格，再选数字。";
    return;
  }
  if (value === null) state.puzzle.entries.delete(state.selected);
  else state.puzzle.entries.set(state.selected, value);
  renderSudoku();
}

function checkPuzzle() {
  let allFilled = true;
  let allCorrect = true;

  for (let index = 0; index < state.puzzle.size * state.puzzle.size; index += 1) {
    if (state.puzzle.fixed.has(index)) continue;
    const value = state.puzzle.entries.get(index);
    if (!value) allFilled = false;
    if (value !== state.puzzle.solution[index]) allCorrect = false;
  }

  document.querySelectorAll(".sudoku-cell.empty").forEach((cell) => {
    const index = Number(cell.dataset.index);
    const value = state.puzzle.entries.get(index);
    cell.classList.toggle("correct", value === state.puzzle.solution[index]);
    cell.classList.toggle("wrong", Boolean(value) && value !== state.puzzle.solution[index]);
  });

  if (!allFilled) {
    messageEl.textContent = "还有空格没填完。";
    return;
  }
  if (!allCorrect) {
    state.streak = 0;
    state.mistakes += 1;
    messageEl.textContent = "有不对的格子，红色处再想想。";
    syncStats();
    return;
  }

  saveRecord();
  state.streak += 1;
  state.level += 1;
  messageEl.textContent = "答对了。下一题来了。";
  syncStats();
  setTimeout(startPuzzle, 850);
}

function showHint() {
  const config = currentConfig();
  const boxText = config.boxRows ? "；宫格里也不能重复" : "";
  messageEl.textContent = `先找某一行或某一列缺了哪些数字${boxText}。`;
}

function syncStats() {
  levelText.textContent = state.level;
  streakText.textContent = state.streak;
}

function tick() {
  timerText.textContent = formatTime(elapsedSeconds());
}

function elapsedSeconds() {
  return Math.floor((Date.now() - state.startedAt) / 1000);
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(recordKey) || "[]");
  } catch {
    return [];
  }
}

function saveRecord() {
  const records = loadRecords();
  records.unshift({
    mode: sudokuModes[state.mode].name,
    difficulty: difficultyLevels[state.difficulty],
    seconds: elapsedSeconds(),
    mistakes: state.mistakes,
    finishedAt: new Date().toISOString(),
  });
  localStorage.setItem(recordKey, JSON.stringify(records.slice(0, maxStoredRecords)));
  renderRecords();
}

function renderRecords() {
  const records = loadRecords();
  recordListEl.innerHTML = "";
  if (records.length === 0) {
    bestRecordEl.textContent = "还没有完成记录";
    return;
  }

  const best = [...records].sort((a, b) => a.seconds + a.mistakes * 15 - (b.seconds + b.mistakes * 15))[0];
  bestRecordEl.textContent = `最佳：${best.mode} ${best.difficulty || "简单"} ${formatTime(best.seconds)}，错 ${best.mistakes} 次`;

  for (const record of records.slice(0, 5)) {
    const item = document.createElement("li");
    const time = new Date(record.finishedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    item.textContent = `${time} ${record.mode} ${record.difficulty || "简单"} ${formatTime(record.seconds)} 错 ${record.mistakes}`;
    recordListEl.appendChild(item);
  }
}

function exportRecords() {
  const records = loadRecords();
  if (records.length === 0) {
    messageEl.textContent = "还没有记录可以导出。";
    return;
  }

  const rows = [["完成时间", "尺寸", "难度", "用时", "错误次数"]];
  for (const record of records) {
    rows.push([
      new Date(record.finishedAt).toLocaleString("zh-CN"),
      record.mode,
      record.difficulty || "简单",
      formatTime(record.seconds),
      String(record.mistakes),
    ]);
  }
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sudoku-records-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.querySelectorAll(".mode").forEach((button) => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    state.level = 1;
    state.streak = 0;
    document.querySelectorAll(".mode").forEach((item) => item.classList.toggle("active", item === button));
    startPuzzle();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

document.querySelectorAll(".difficulty").forEach((button) => {
  button.addEventListener("click", () => {
    state.difficulty = button.dataset.difficulty;
    state.level = 1;
    state.streak = 0;
    document.querySelectorAll(".difficulty").forEach((item) => item.classList.toggle("active", item === button));
    startPuzzle();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

document.querySelector("#checkBtn").addEventListener("click", checkPuzzle);
document.querySelector("#hintBtn").addEventListener("click", showHint);
document.querySelector("#newBtn").addEventListener("click", startPuzzle);
document.querySelector("#clearRecordsBtn").addEventListener("click", () => {
  localStorage.removeItem(recordKey);
  renderRecords();
});
document.querySelector("#exportRecordsBtn").addEventListener("click", exportRecords);

document.addEventListener("keydown", (event) => {
  if (/^[1-9]$/.test(event.key)) enterValue(Number(event.key));
  if (event.key === "Backspace" || event.key === "Delete") enterValue(null);
  if (state.selected === null) return;

  const size = state.puzzle.size;
  if (event.key === "ArrowLeft") state.selected = Math.max(0, state.selected - 1);
  if (event.key === "ArrowRight") state.selected = Math.min(size * size - 1, state.selected + 1);
  if (event.key === "ArrowUp") state.selected = Math.max(0, state.selected - size);
  if (event.key === "ArrowDown") state.selected = Math.min(size * size - 1, state.selected + size);
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) renderSudoku();
});

state.timer = setInterval(tick, 1000);
startPuzzle();
