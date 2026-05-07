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
const starKey = "sudoku-trainer-stars-v1";
const progressKey = "sudoku-trainer-progress-v1";
const maxStoredRecords = 500;
const maxHistory = 120;

const state = {
  mode: "seedling",
  difficulty: "easy",
  puzzle: null,
  selected: null,
  level: 1,
  streak: 0,
  mistakes: 0,
  stars: Number(localStorage.getItem(starKey) || "0"),
  showCandidates: false,
  instantFeedback: true,
  noteMode: false,
  history: [],
  feedbackIndex: null,
  correctIndex: null,
  correctRun: 0,
  completed: false,
  audioContext: null,
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
const starIconsEl = document.querySelector("#starIcons");
const starCountEl = document.querySelector("#starCount");
const candidateToggle = document.querySelector("#candidateToggle");
const instantToggle = document.querySelector("#instantToggle");
const noteToggle = document.querySelector("#noteToggle");
const recordBodyEl = document.querySelector("#recordBody");
const toggleRecordsBtn = document.querySelector("#toggleRecordsBtn");
const celebrationEl = document.querySelector("#celebration");
const celebrationTextEl = document.querySelector("#celebrationText");
const confettiEl = document.querySelector("#confetti");
const encouragementEl = document.querySelector("#encouragement");

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function startPuzzle() {
  const config = currentConfig();
  state.puzzle = buildSudokuPuzzle(config);
  state.selected = state.puzzle.cells.findIndex((cell) => cell === 0);
  state.mistakes = 0;
  state.history = [];
  state.correctRun = 0;
  state.completed = false;
  state.startedAt = Date.now();
  saveProgress();
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
    notes: new Map(),
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
    const entry = state.puzzle.entries.get(index);
    const manualNotes = state.puzzle.notes.get(index);
    const value = fixed ? state.puzzle.cells[index] : entry || "";
    const cell = makeButton("cell sudoku-cell", "");
    const row = Math.floor(index / size);
    const col = index % size;
    cell.dataset.index = index;
    cell.setAttribute("aria-label", `第 ${row + 1} 行第 ${col + 1} 列${value ? `，${value}` : "，空格"}`);
    if (state.puzzle.boxCols && (col + 1) % state.puzzle.boxCols === 0 && col < size - 1) cell.classList.add("box-right");
    if (state.puzzle.boxRows && (row + 1) % state.puzzle.boxRows === 0 && row < size - 1) cell.classList.add("box-bottom");
    addPeerClasses(cell, index);
    if (sameValue(value)) cell.classList.add("same-value");
    if (fixed) {
      cell.classList.add("fixed");
      cell.textContent = value;
      cell.disabled = true;
    } else {
      cell.classList.add("empty");
      if (entry) {
        cell.textContent = entry;
        cell.classList.add("user-filled");
        if (state.instantFeedback) {
          cell.classList.toggle("wrong", entry !== state.puzzle.solution[index]);
          cell.classList.toggle("correct", entry === state.puzzle.solution[index]);
        }
        if (state.feedbackIndex === index) cell.classList.add("feedback-flash");
        if (state.correctIndex === index) cell.classList.add("correct-pop");
      } else if (manualNotes && manualNotes.size > 0) {
        cell.appendChild(renderNoteGrid(manualNotes, size));
      } else if (state.showCandidates) {
        cell.appendChild(renderCandidateGrid(index));
      }
      if (state.selected === index) cell.classList.add("selected");
      cell.addEventListener("click", () => selectCell(index));
    }
    boardEl.appendChild(cell);
  }

  renderPad(size);
  syncStats();
}

function renderCandidateGrid(index) {
  const size = state.puzzle.size;
  const wrap = document.createElement("span");
  wrap.className = "candidates auto-candidates";
  wrap.style.setProperty("--candidate-cols", Math.ceil(Math.sqrt(size)));
  for (const value of getCandidates(index)) {
    const item = document.createElement("span");
    item.textContent = value;
    wrap.appendChild(item);
  }
  return wrap;
}

function renderNoteGrid(notes, size) {
  const wrap = document.createElement("span");
  wrap.className = "candidates notes";
  wrap.style.setProperty("--candidate-cols", Math.ceil(Math.sqrt(size)));
  for (const value of [...notes].sort((a, b) => a - b)) {
    const item = document.createElement("span");
    item.textContent = value;
    wrap.appendChild(item);
  }
  return wrap;
}

function renderPad(max) {
  padEl.innerHTML = "";
  padEl.dataset.max = max;
  for (let value = 1; value <= max; value += 1) {
    const button = makeButton("", value);
    const remaining = remainingCount(value);
    button.classList.toggle("used-up", remaining === 0);
    const main = document.createElement("span");
    main.textContent = value;
    const sub = document.createElement("small");
    sub.textContent = remaining;
    button.textContent = "";
    button.append(main, sub);
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
  saveProgress();
  renderSudoku();
}

function canEditSelected() {
  return state.selected !== null && state.puzzle && !state.puzzle.fixed.has(state.selected);
}

function enterValue(value) {
  unlockAudio();
  if (!canEditSelected()) {
    messageEl.textContent = "先点一个空格，再选数字。";
    return;
  }
  pushHistory();

  if (value === null) {
    state.puzzle.entries.delete(state.selected);
    state.puzzle.notes.delete(state.selected);
  } else if (state.noteMode) {
    state.puzzle.entries.delete(state.selected);
    toggleNote(state.selected, value);
  } else {
    state.puzzle.entries.set(state.selected, value);
    state.puzzle.notes.delete(state.selected);
  }

  if (!state.noteMode && value !== null && state.instantFeedback && value !== state.puzzle.solution[state.selected]) {
    state.mistakes += 1;
    state.correctRun = 0;
    state.feedbackIndex = state.selected;
    messageEl.textContent = "这个数字和当前题目不匹配，看看同行、同列或同宫格。";
    playMistakeSound();
    setTimeout(() => {
      state.feedbackIndex = null;
      renderSudoku();
    }, 480);
  } else if (!state.noteMode && value !== null && state.instantFeedback) {
    state.correctRun += 1;
    state.correctIndex = state.selected;
    messageEl.textContent = "这个格子填对了。";
    playCorrectSound(state.correctRun);
    showCorrectEncouragement(state.correctRun);
    setTimeout(() => {
      state.correctIndex = null;
      renderSudoku();
    }, 950);
  }
  saveProgress();
  renderSudoku();
  maybeAutoFinish();
}

function eraseSelected() {
  unlockAudio();
  if (!canEditSelected()) {
    messageEl.textContent = "先点一个要擦除的空格。";
    return;
  }
  const hasContent = state.puzzle.entries.has(state.selected) || state.puzzle.notes.has(state.selected);
  if (!hasContent) {
    messageEl.textContent = "这个格子已经是空的。";
    return;
  }
  pushHistory();
  state.puzzle.entries.delete(state.selected);
  state.puzzle.notes.delete(state.selected);
  messageEl.textContent = "已擦除当前格。";
  saveProgress();
  renderSudoku();
}

function toggleNote(index, value) {
  const notes = new Set(state.puzzle.notes.get(index) || []);
  if (notes.has(value)) notes.delete(value);
  else notes.add(value);
  if (notes.size === 0) state.puzzle.notes.delete(index);
  else state.puzzle.notes.set(index, notes);
}

function pushHistory() {
  state.history.push(snapshotPuzzle());
  if (state.history.length > maxHistory) state.history.shift();
}

function undoMove() {
  unlockAudio();
  const snapshot = state.history.pop();
  if (!snapshot) {
    messageEl.textContent = "还没有可撤销的步骤。";
    return;
  }
  restoreSnapshot(snapshot);
  messageEl.textContent = "已撤销上一步。";
  saveProgress();
  renderSudoku();
}

function checkPuzzle() {
  unlockAudio();
  const result = puzzleResult();
  markCurrentErrors();

  if (!result.allFilled) {
    messageEl.textContent = "还有空格没填完。";
    return;
  }
  if (!result.allCorrect) {
    state.streak = 0;
    state.mistakes += 1;
    messageEl.textContent = "有不对的格子，红色处再想想。";
    syncStats();
    return;
  }

  finishPuzzle();
}

function puzzleResult() {
  let allFilled = true;
  let allCorrect = true;

  for (let index = 0; index < state.puzzle.size * state.puzzle.size; index += 1) {
    if (state.puzzle.fixed.has(index)) continue;
    const value = state.puzzle.entries.get(index);
    if (!value) allFilled = false;
    if (value !== state.puzzle.solution[index]) allCorrect = false;
  }

  return { allFilled, allCorrect };
}

function markCurrentErrors() {
  document.querySelectorAll(".sudoku-cell.empty").forEach((cell) => {
    const index = Number(cell.dataset.index);
    const value = state.puzzle.entries.get(index);
    cell.classList.toggle("correct", value === state.puzzle.solution[index]);
    cell.classList.toggle("wrong", Boolean(value) && value !== state.puzzle.solution[index]);
  });
}

function maybeAutoFinish() {
  if (state.completed) return;
  const result = puzzleResult();
  if (!result.allFilled) return;
  markCurrentErrors();
  if (result.allCorrect) finishPuzzle();
  else messageEl.textContent = "已经填满了，还有红色格子需要再改。";
}

function finishPuzzle() {
  if (state.completed) return;
  state.completed = true;
  saveRecord();
  addStar();
  localStorage.removeItem(progressKey);
  state.streak += 1;
  state.level += 1;
  messageEl.textContent = "答对了。下一题来了。";
  syncStats();
  playFinishSound();
  showCelebration();
}

function showHint() {
  const hint = findStepHint();
  messageEl.textContent = hint.text;
  if (hint.index !== null) state.selected = hint.index;
  renderSudoku();
}

function syncStats() {
  levelText.textContent = state.level;
  streakText.textContent = state.streak;
  renderStars();
}

function renderStars() {
  const filled = Math.min(state.stars, 5);
  starIconsEl.textContent = "★".repeat(filled) + "☆".repeat(5 - filled);
  starCountEl.textContent = state.stars;
}

function addStar() {
  state.stars += 1;
  localStorage.setItem(starKey, String(state.stars));
}

function showCelebration() {
  celebrationTextEl.textContent = `${sudokuModes[state.mode].name} ${difficultyLevels[state.difficulty]}，用时 ${formatTime(elapsedSeconds())}，错 ${state.mistakes} 次。`;
  renderConfetti();
  celebrationEl.classList.remove("hidden");
}

function closeCelebration() {
  unlockAudio();
  celebrationEl.classList.add("hidden");
  startPuzzle();
}

function showCorrectEncouragement(run) {
  if (run < 2) return;
  const messages = ["连续 2 个", "连续 3 个，很稳", "连续 4 个", "手感来了"];
  encouragementEl.textContent = messages[Math.min(run - 2, messages.length - 1)];
  encouragementEl.classList.remove("hidden", "encouragement-pop");
  requestAnimationFrame(() => encouragementEl.classList.add("encouragement-pop"));
  setTimeout(() => encouragementEl.classList.add("hidden"), 920);
}

function renderConfetti() {
  confettiEl.innerHTML = "";
  for (let index = 0; index < 74; index += 1) {
    const piece = document.createElement("i");
    piece.style.setProperty("--x", `${Math.random() * 360 - 180}px`);
    piece.style.setProperty("--y", `${Math.random() * 260 + 80}px`);
    piece.style.setProperty("--r", `${Math.random() * 900 - 450}deg`);
    piece.style.setProperty("--delay", `${Math.random() * 0.38}s`);
    piece.style.setProperty("--c", ["#f2b84b", "#4c9b72", "#255d8a", "#cf5c56"][index % 4]);
    confettiEl.appendChild(piece);
  }
}

function unlockAudio() {
  if (!window.AudioContext && !window.webkitAudioContext) return null;
  if (!state.audioContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new Context();
  }
  if (state.audioContext.state === "suspended") state.audioContext.resume();
  return state.audioContext;
}

function playTone(frequency, start, duration, type = "sine", volume = 0.08) {
  const audio = unlockAudio();
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime + start);
  gain.gain.setValueAtTime(0.0001, audio.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, audio.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(audio.currentTime + start);
  oscillator.stop(audio.currentTime + start + duration + 0.03);
}

function playCorrectSound(run) {
  const lift = Math.min(run, 5) * 28;
  playTone(659 + lift, 0, 0.1, "triangle", 0.06);
  playTone(880 + lift, 0.07, 0.12, "triangle", 0.055);
  playTone(1175 + lift, 0.16, 0.16, "sine", 0.04);
}

function playMistakeSound() {
  playTone(190, 0, 0.14, "sawtooth", 0.035);
}

function playFinishSound() {
  [523, 659, 784, 1047, 1319].forEach((frequency, index) => playTone(frequency, index * 0.09, 0.2, "triangle", 0.075));
  playTone(1568, 0.46, 0.32, "sine", 0.062);
  playTone(1047, 0.52, 0.38, "triangle", 0.035);
}

function sameValue(value) {
  if (state.selected === null || !value) return false;
  return valueAt(state.selected) === Number(value);
}

function addPeerClasses(cell, index) {
  if (state.selected === null || index === state.selected) return;
  const size = state.puzzle.size;
  const row = Math.floor(index / size);
  const col = index % size;
  const selectedRow = Math.floor(state.selected / size);
  const selectedCol = state.selected % size;
  if (row === selectedRow) cell.classList.add("row-peer");
  if (col === selectedCol) cell.classList.add("col-peer");
  if (!state.puzzle.boxRows || !state.puzzle.boxCols) return;
  if (
    Math.floor(row / state.puzzle.boxRows) === Math.floor(selectedRow / state.puzzle.boxRows) &&
    Math.floor(col / state.puzzle.boxCols) === Math.floor(selectedCol / state.puzzle.boxCols)
  ) {
    cell.classList.add("box-peer");
  }
}

function getCandidates(index) {
  const size = state.puzzle.size;
  const row = Math.floor(index / size);
  const col = index % size;
  const used = new Set();

  for (let c = 0; c < size; c += 1) used.add(valueAt(row * size + c));
  for (let r = 0; r < size; r += 1) used.add(valueAt(r * size + col));

  if (state.puzzle.boxRows && state.puzzle.boxCols) {
    const startRow = Math.floor(row / state.puzzle.boxRows) * state.puzzle.boxRows;
    const startCol = Math.floor(col / state.puzzle.boxCols) * state.puzzle.boxCols;
    for (let r = startRow; r < startRow + state.puzzle.boxRows; r += 1) {
      for (let c = startCol; c < startCol + state.puzzle.boxCols; c += 1) used.add(valueAt(r * size + c));
    }
  }

  return Array.from({ length: size }, (_, value) => value + 1).filter((value) => !used.has(value));
}

function valueAt(index) {
  if (state.puzzle.fixed.has(index)) return state.puzzle.cells[index];
  return state.puzzle.entries.get(index) || 0;
}

function remainingCount(value) {
  const used = state.puzzle.cells.filter((cell) => cell === value).length + [...state.puzzle.entries.values()].filter((entry) => entry === value).length;
  return Math.max(0, state.puzzle.size - used);
}

function findStepHint() {
  const size = state.puzzle.size;
  for (let index = 0; index < size * size; index += 1) {
    if (state.puzzle.fixed.has(index) || state.puzzle.entries.has(index)) continue;
    const candidates = getCandidates(index);
    if (candidates.length === 1) {
      const row = Math.floor(index / size) + 1;
      const col = index % size + 1;
      return { index, text: `第 ${row} 行第 ${col} 列只剩 ${candidates[0]} 可以填。` };
    }
  }

  const groups = buildGroups();
  for (const group of groups) {
    for (let value = 1; value <= size; value += 1) {
      const places = group.indexes.filter((index) =>
        !state.puzzle.fixed.has(index) && !state.puzzle.entries.has(index) && getCandidates(index).includes(value),
      );
      if (places.length === 1) {
        const index = places[0];
        const row = Math.floor(index / size) + 1;
        const col = index % size + 1;
        return { index, text: `${group.name} 里，数字 ${value} 只能放在第 ${row} 行第 ${col} 列。` };
      }
    }
  }

  return { index: state.selected, text: "这一题暂时没有简单一步提示。可以打开候选数，先找候选最少的格子。" };
}

function buildGroups() {
  const size = state.puzzle.size;
  const groups = [];
  for (let row = 0; row < size; row += 1) groups.push({ name: `第 ${row + 1} 行`, indexes: Array.from({ length: size }, (_, col) => row * size + col) });
  for (let col = 0; col < size; col += 1) groups.push({ name: `第 ${col + 1} 列`, indexes: Array.from({ length: size }, (_, row) => row * size + col) });
  if (state.puzzle.boxRows && state.puzzle.boxCols) {
    let box = 1;
    for (let row = 0; row < size; row += state.puzzle.boxRows) {
      for (let col = 0; col < size; col += state.puzzle.boxCols) {
        const indexes = [];
        for (let r = row; r < row + state.puzzle.boxRows; r += 1) {
          for (let c = col; c < col + state.puzzle.boxCols; c += 1) indexes.push(r * size + c);
        }
        groups.push({ name: `第 ${box} 宫`, indexes });
        box += 1;
      }
    }
  }
  return groups;
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

function snapshotPuzzle() {
  return {
    entries: [...state.puzzle.entries],
    notes: [...state.puzzle.notes].map(([index, values]) => [index, [...values]]),
    selected: state.selected,
    mistakes: state.mistakes,
    startedAt: state.startedAt,
  };
}

function restoreSnapshot(snapshot) {
  state.puzzle.entries = new Map(snapshot.entries);
  state.puzzle.notes = new Map(snapshot.notes.map(([index, values]) => [index, new Set(values)]));
  state.selected = snapshot.selected;
  state.mistakes = snapshot.mistakes;
  state.startedAt = snapshot.startedAt;
}

function saveProgress() {
  if (!state.puzzle) return;
  const payload = {
    mode: state.mode,
    difficulty: state.difficulty,
    puzzle: {
      size: state.puzzle.size,
      boxRows: state.puzzle.boxRows,
      boxCols: state.puzzle.boxCols,
      solution: state.puzzle.solution,
      cells: state.puzzle.cells,
      fixed: [...state.puzzle.fixed],
      entries: [...state.puzzle.entries],
      notes: [...state.puzzle.notes].map(([index, values]) => [index, [...values]]),
    },
    selected: state.selected,
    mistakes: state.mistakes,
    level: state.level,
    streak: state.streak,
    correctRun: state.correctRun,
    startedAt: state.startedAt,
    elapsed: elapsedSeconds(),
    history: state.history,
    savedAt: Date.now(),
  };
  localStorage.setItem(progressKey, JSON.stringify(payload));
}

function loadProgress() {
  try {
    const payload = JSON.parse(localStorage.getItem(progressKey) || "null");
    if (!payload || !payload.puzzle) return false;
    state.mode = payload.mode || "seedling";
    state.difficulty = payload.difficulty || "easy";
    state.puzzle = {
      ...payload.puzzle,
      fixed: new Set(payload.puzzle.fixed),
      entries: new Map(payload.puzzle.entries),
      notes: new Map((payload.puzzle.notes || []).map(([index, values]) => [index, new Set(values)])),
    };
    state.selected = payload.selected;
    state.mistakes = payload.mistakes || 0;
    state.level = payload.level || 1;
    state.streak = payload.streak || 0;
    state.correctRun = payload.correctRun || 0;
    state.completed = false;
    state.startedAt = Date.now() - (payload.elapsed || 0) * 1000;
    state.history = payload.history || [];
    return true;
  } catch {
    localStorage.removeItem(progressKey);
    return false;
  }
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
document.querySelector("#undoBtn").addEventListener("click", undoMove);
document.querySelector("#eraseBtn").addEventListener("click", eraseSelected);
document.querySelector("#clearRecordsBtn").addEventListener("click", () => {
  localStorage.removeItem(recordKey);
  renderRecords();
});
document.querySelector("#exportRecordsBtn").addEventListener("click", exportRecords);
document.querySelector("#celebrationBtn").addEventListener("click", closeCelebration);
candidateToggle.addEventListener("change", () => {
  state.showCandidates = candidateToggle.checked;
  renderSudoku();
});
instantToggle.addEventListener("change", () => {
  state.instantFeedback = instantToggle.checked;
  renderSudoku();
});
noteToggle.addEventListener("change", () => {
  state.noteMode = noteToggle.checked;
  messageEl.textContent = state.noteMode ? "笔记模式：点数字会记录候选数，不会直接填入答案。" : "已回到填写模式。";
});
toggleRecordsBtn.addEventListener("click", () => {
  recordBodyEl.classList.toggle("hidden");
  toggleRecordsBtn.textContent = recordBodyEl.classList.contains("hidden") ? "做题记录 ▸" : "做题记录 ▾";
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "n") {
    noteToggle.checked = !noteToggle.checked;
    state.noteMode = noteToggle.checked;
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoMove();
    return;
  }
  if (/^[1-9]$/.test(event.key)) enterValue(Number(event.key));
  if (event.key === "Backspace" || event.key === "Delete") enterValue(null);
  if (state.selected === null) return;

  const size = state.puzzle.size;
  if (event.key === "ArrowLeft") state.selected = Math.max(0, state.selected - 1);
  if (event.key === "ArrowRight") state.selected = Math.min(size * size - 1, state.selected + 1);
  if (event.key === "ArrowUp") state.selected = Math.max(0, state.selected - size);
  if (event.key === "ArrowDown") state.selected = Math.min(size * size - 1, state.selected + size);
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    saveProgress();
    renderSudoku();
  }
});

window.addEventListener("beforeunload", saveProgress);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveProgress();
});

state.timer = setInterval(tick, 250);
if (loadProgress()) {
  document.querySelectorAll(".mode").forEach((item) => item.classList.toggle("active", item.dataset.mode === state.mode));
  document.querySelectorAll(".difficulty").forEach((item) => item.classList.toggle("active", item.dataset.difficulty === state.difficulty));
  messageEl.textContent = "已恢复上次未完成的题。";
  renderSudoku();
  renderRecords();
  tick();
} else {
  startPuzzle();
}

if (new URLSearchParams(window.location.search).has("test")) {
  window.__sudokuTest = {
    pickEditable() {
      const index = state.puzzle.cells.findIndex((cell, current) => cell === 0 && !state.puzzle.fixed.has(current));
      const correct = state.puzzle.solution[index];
      const wrong = correct === 1 ? 2 : 1;
      return { index, correct, wrong };
    },
    prepareOneMissing() {
      const editable = state.puzzle.cells
        .map((cell, index) => ({ cell, index }))
        .filter(({ index }) => !state.puzzle.fixed.has(index));
      const target = editable[editable.length - 1].index;
      for (const { index } of editable) {
        if (index === target) continue;
        state.puzzle.entries.set(index, state.puzzle.solution[index]);
      }
      state.puzzle.entries.delete(target);
      state.selected = target;
      state.completed = false;
      renderSudoku();
      return { index: target, correct: state.puzzle.solution[target] };
    },
  };
}
