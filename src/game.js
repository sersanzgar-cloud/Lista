// Controlador principal de Terminal Academy.
window.TA = window.TA || {};

(function () {
  const STORAGE_KEY = 'terminal-academy-progress-v1';
  const LEVELS = TA.LEVELS;

  const els = {};
  let state = {
    levelIndex: 0,
    completed: new Set(),
    vfs: null,
    cwd: [],
    history: [],
    visited: new Set(),
    inputHistory: [],
    inputPointer: 0,
    hintIndex: 0,
    levelDone: false,
    env: {},
    processes: [],
    jobs: [],
    network: { routes: {}, hosts: {}, ports: [] },
    umask: '022',
  };

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw));
    } catch {
      return new Set();
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.completed]));
  }

  function isUnlocked(i) {
    return i === 0 || state.completed.has(i - 1) || state.completed.has(i);
  }

  function cacheEls() {
    els.sidebar = document.getElementById('level-list');
    els.title = document.getElementById('level-title');
    els.story = document.getElementById('level-story');
    els.objective = document.getElementById('level-objective');
    els.commandChips = document.getElementById('command-chips');
    els.hintBtn = document.getElementById('hint-btn');
    els.hintText = document.getElementById('hint-text');
    els.resetBtn = document.getElementById('reset-btn');
    els.output = document.getElementById('terminal-output');
    els.input = document.getElementById('terminal-input');
    els.prompt = document.getElementById('terminal-prompt');
    els.progressFill = document.getElementById('progress-fill');
    els.progressLabel = document.getElementById('progress-label');
    els.successBanner = document.getElementById('success-banner');
    els.nextBtn = document.getElementById('next-level-btn');
    els.mobileToolbar = document.getElementById('mobile-toolbar');
  }

  function renderSidebar() {
    els.sidebar.innerHTML = '';
    LEVELS.forEach((level, i) => {
      const li = document.createElement('li');
      const unlocked = isUnlocked(i);
      const done = state.completed.has(i);
      li.className = 'level-item'
        + (i === state.levelIndex ? ' active' : '')
        + (done ? ' done' : '')
        + (!unlocked ? ' locked' : '');
      const icon = done ? '✔' : (unlocked ? String(i + 1).padStart(2, '0') : '🔒');
      li.innerHTML = `<span class="level-icon">${icon}</span><span class="level-name">${level.title.replace(/^Nivel \d+ · /, '')}</span>`;
      if (unlocked) {
        li.addEventListener('click', () => loadLevel(i));
      }
      els.sidebar.appendChild(li);
    });
    const pct = Math.round((state.completed.size / LEVELS.length) * 100);
    els.progressFill.style.width = `${pct}%`;
    els.progressLabel.textContent = `${state.completed.size} / ${LEVELS.length} niveles completados`;
  }

  function promptText() {
    const cwdStr = state.vfs.pathToStr(state.cwd);
    const short = cwdStr.replace(/^\/home\/jugador/, '~');
    return `jugador@academia:${short}$`;
  }

  function printLine(text, cls) {
    const line = document.createElement('div');
    line.className = 'term-line' + (cls ? ` ${cls}` : '');
    line.textContent = text;
    els.output.appendChild(line);
    els.output.scrollTop = els.output.scrollHeight;
  }

  function printBlock(text, cls) {
    if (text === '') return;
    text.split('\n').forEach((l) => printLine(l, cls));
  }

  function printExplain(text) {
    if (!text) return;
    printLine(`💡 ${text}`, 'term-explain');
  }

  function loadLevel(i) {
    const level = LEVELS[i];
    state.levelIndex = i;
    state.vfs = new TA.VFS(level.createFs());
    state.cwd = [...level.startCwd];
    state.history = [];
    state.visited = new Set();
    state.inputHistory = [];
    state.inputPointer = 0;
    state.hintIndex = 0;
    state.levelDone = state.completed.has(i);
    state.env = level.createEnv ? level.createEnv() : {};
    state.processes = level.createProcesses ? level.createProcesses() : [];
    state.jobs = [];
    state.network = level.createNetwork ? level.createNetwork() : { routes: {}, hosts: {}, ports: [] };
    state.umask = level.initialUmask || '022';

    els.title.textContent = level.title;
    els.story.textContent = level.story;
    els.objective.textContent = level.objective;
    els.commandChips.innerHTML = level.commands
      .map((c) => `<span class="chip">${c}</span>`)
      .join('');
    els.hintText.textContent = '';
    els.hintText.classList.remove('visible');
    const isLast = i === LEVELS.length - 1;
    if (state.levelDone) {
      els.successBanner.classList.add('visible');
      els.nextBtn.style.display = isLast ? 'none' : 'inline-block';
    } else {
      els.successBanner.classList.remove('visible');
      els.nextBtn.style.display = 'none';
    }
    els.output.innerHTML = '';
    printLine(`--- ${level.title} ---`, 'term-meta');
    printLine(level.story, 'term-meta');
    printLine('Escribe "help" para ver los comandos disponibles. Tab autocompleta, Ctrl+L limpia la pantalla.', 'term-meta');
    els.prompt.textContent = promptText();
    els.input.value = '';
    els.input.focus();

    renderSidebar();
  }

  function buildExecCtx() {
    return {
      vfs: state.vfs,
      getCwd: () => state.cwd,
      setCwd: (arr) => { state.cwd = arr; },
      env: state.env,
      currentUser: 'jugador',
      userGroups: ['jugador', 'sudo'],
      sudo: false,
      processes: state.processes,
      jobs: state.jobs,
      network: state.network,
      getUmask: () => state.umask,
      setUmask: (val) => { state.umask = val; },
    };
  }

  function markComplete() {
    if (state.completed.has(state.levelIndex)) return;
    state.completed.add(state.levelIndex);
    saveProgress();
    state.levelDone = true;
    els.successBanner.classList.add('visible');
    const isLast = state.levelIndex === LEVELS.length - 1;
    els.nextBtn.style.display = isLast ? 'none' : 'inline-block';
    renderSidebar();
  }

  function handleClear() {
    els.output.innerHTML = '';
  }

  function runCommandLine(raw) {
    const trimmed = raw.trim();
    if (trimmed === '') return;

    printLine(`${promptText()} ${raw}`, 'term-input-echo');
    state.inputHistory.push(raw);
    state.inputPointer = state.inputHistory.length;

    if (trimmed === 'clear') {
      handleClear();
      return;
    }

    const ctx = buildExecCtx();
    const result = TA.Shell.runLine(trimmed, ctx);

    for (const stage of result.stages) {
      state.history.push({ ...stage, raw: trimmed });
      if (stage.cmd === 'cd' && !stage.error) {
        state.visited.add(state.vfs.pathToStr(state.cwd));
      }
    }

    if (!result.ok) {
      printBlock(result.output, 'term-error');
      printExplain(result.explain);
    } else {
      printBlock(result.output, 'term-output');
    }

    els.prompt.textContent = promptText();

    if (!state.levelDone) {
      const level = LEVELS[state.levelIndex];
      const passed = level.check({
        vfs: state.vfs,
        cwd: state.cwd,
        history: state.history,
        visited: state.visited,
        env: state.env,
        processes: state.processes,
        jobs: state.jobs,
        network: state.network,
        umask: state.umask,
      });
      if (passed) markComplete();
    }
  }

  function nextHint() {
    const level = LEVELS[state.levelIndex];
    if (state.hintIndex >= level.hints.length) state.hintIndex = 0;
    els.hintText.textContent = level.hints[state.hintIndex];
    els.hintText.classList.add('visible');
    state.hintIndex++;
  }

  function completeInput() {
    const raw = els.input.value;
    const endsWithSpace = raw.length === 0 || /\s$/.test(raw);
    const tokens = TA.Shell.tokenize(raw);
    const isCommandSlot = tokens.length === 0 || (tokens.length === 1 && !endsWithSpace);

    const m = raw.match(/(\S*)$/);
    const currentToken = endsWithSpace ? '' : (m ? m[1] : '');
    const tokenStart = raw.length - currentToken.length;

    let candidates = [];
    if (isCommandSlot) {
      candidates = Object.keys(TA.Shell.COMMANDS).filter((c) => c.startsWith(currentToken)).sort();
    } else {
      const slashIdx = currentToken.lastIndexOf('/');
      const dirPart = slashIdx === -1 ? '' : currentToken.slice(0, slashIdx + 1);
      const filePrefix = slashIdx === -1 ? currentToken : currentToken.slice(slashIdx + 1);
      const dirPath = state.vfs.normalize(dirPart || '.', state.cwd);
      const dirNode = state.vfs.getNode(dirPath);
      if (dirNode && dirNode.type === 'dir') {
        candidates = Object.keys(dirNode.children)
          .filter((n) => n.startsWith(filePrefix))
          .sort()
          .map((n) => dirPart + n + (dirNode.children[n].type === 'dir' ? '/' : ''));
      }
    }

    if (candidates.length === 0) return;
    if (candidates.length === 1) {
      const completion = candidates[0];
      els.input.value = raw.slice(0, tokenStart) + completion + (completion.endsWith('/') ? '' : ' ');
    } else {
      printLine(`${promptText()} ${raw}`, 'term-input-echo');
      printLine(candidates.join('   '), 'term-meta');
    }
  }

  function submitInput() {
    const val = els.input.value;
    els.input.value = '';
    runCommandLine(val);
  }

  function historyBack() {
    if (state.inputHistory.length === 0) return;
    state.inputPointer = Math.max(0, state.inputPointer - 1);
    els.input.value = state.inputHistory[state.inputPointer] || '';
  }

  function historyForward() {
    if (state.inputHistory.length === 0) return;
    state.inputPointer = Math.min(state.inputHistory.length, state.inputPointer + 1);
    els.input.value = state.inputHistory[state.inputPointer] || '';
  }

  function insertAtCursor(text) {
    const start = els.input.selectionStart ?? els.input.value.length;
    const end = els.input.selectionEnd ?? els.input.value.length;
    const val = els.input.value;
    els.input.value = val.slice(0, start) + text + val.slice(end);
    const pos = start + text.length;
    els.input.setSelectionRange(pos, pos);
    els.input.focus();
  }

  function bindEvents() {
    els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitInput();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        historyBack();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        historyForward();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        completeInput();
      } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleClear();
      }
    });

    els.hintBtn.addEventListener('click', nextHint);
    els.resetBtn.addEventListener('click', () => loadLevel(state.levelIndex));
    els.nextBtn.addEventListener('click', () => {
      if (state.levelIndex < LEVELS.length - 1) loadLevel(state.levelIndex + 1);
    });

    els.commandChips.addEventListener('click', (e) => {
      if (e.target.classList.contains('chip')) {
        els.input.value = e.target.textContent + ' ';
        els.input.focus();
      }
    });

    // Evita que los botones de la barra táctil roben el foco (y cierren el teclado) al pulsarlos.
    els.mobileToolbar.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) e.preventDefault();
    });
    els.mobileToolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.insert !== undefined) {
        insertAtCursor(btn.dataset.insert);
        return;
      }
      switch (btn.dataset.action) {
        case 'tab': completeInput(); break;
        case 'up': historyBack(); break;
        case 'down': historyForward(); break;
        case 'enter': submitInput(); break;
        case 'backspace': {
          const start = els.input.selectionStart ?? els.input.value.length;
          if (start > 0) {
            els.input.value = els.input.value.slice(0, start - 1) + els.input.value.slice(start);
            els.input.setSelectionRange(start - 1, start - 1);
          }
          els.input.focus();
          break;
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.terminal') && !e.target.closest('#mobile-toolbar')) els.input.focus();
    });
  }

  function init() {
    cacheEls();
    state.completed = loadProgress();
    bindEvents();
    const firstUnfinished = LEVELS.findIndex((_, i) => !state.completed.has(i));
    loadLevel(firstUnfinished === -1 ? LEVELS.length - 1 : firstUnfinished);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
