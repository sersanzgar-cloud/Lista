// Controlador principal de Terminal Academy.
window.TA = window.TA || {};

(function () {
  const STORAGE_KEY = 'terminal-academy-progress-v1';
  const BEST_KEY = 'terminal-academy-best-v1';
  const LEVELS = TA.LEVELS;
  const CHALLENGES = TA.CHALLENGES;

  const els = {};
  let state = {
    mode: 'learn',
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
    packages: { installed: [], available: [] },
    services: [],
    users: [],
    groups: [],
    firewall: { enabled: false, rules: [] },
    mounts: [],
    openFiles: [],
    aliases: {},
    challenge: {
      active: false,
      queue: [],
      queuePos: 0,
      current: null,
      resolved: false,
      vfs: null,
      cwd: [],
      history: [],
      visited: new Set(),
      inputHistory: [],
      inputPointer: 0,
      env: {},
      processes: [],
      jobs: [],
      network: { routes: {}, hosts: {}, ports: [] },
      umask: '022',
      packages: { installed: [], available: [] },
      services: [],
      users: [],
      groups: [],
      firewall: { enabled: false, rules: [] },
      mounts: [],
      openFiles: [],
      aliases: {},
      lives: 3,
      score: 0,
      streak: 0,
      best: 0,
      timeLimit: 0,
      timeLeft: 0,
      timerHandle: null,
    },
  };

  function activeState() {
    return state.mode === 'challenge' ? state.challenge : state;
  }

  function loadBest() {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest(score) {
    localStorage.setItem(BEST_KEY, String(score));
  }

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
    els.appMain = document.querySelector('.app-main');
    els.tabLearn = document.getElementById('tab-learn');
    els.tabChallenge = document.getElementById('tab-challenge');
    els.sidebar = document.getElementById('level-list');
    els.learnPanel = document.getElementById('learn-panel');
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

    els.challengeIntro = document.getElementById('challenge-intro');
    els.challengeBestIntro = document.getElementById('challenge-best-intro');
    els.challengeStartBtn = document.getElementById('challenge-start-btn');
    els.challengePanel = document.getElementById('challenge-panel');
    els.challengeLives = document.getElementById('challenge-lives');
    els.challengeScore = document.getElementById('challenge-score');
    els.challengeStreak = document.getElementById('challenge-streak');
    els.challengeBest = document.getElementById('challenge-best');
    els.challengeTierLabel = document.getElementById('challenge-tier-label');
    els.challengeObjective = document.getElementById('challenge-objective');
    els.timerBarFill = document.getElementById('timer-bar-fill');
    els.challengeGameover = document.getElementById('challenge-gameover');
    els.gameoverScore = document.getElementById('gameover-score');
    els.gameoverBest = document.getElementById('gameover-best');
    els.challengeRestartBtn = document.getElementById('challenge-restart-btn');
    els.challengeToLearnBtn = document.getElementById('challenge-to-learn-btn');
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
      const levelNum = level.id.replace('nivel-', '').padStart(2, '0');
      const icon = done ? '✔' : (unlocked ? levelNum : '🔒');
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
    const s = activeState();
    const cwdStr = s.vfs.pathToStr(s.cwd);
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
    state.packages = level.createPackages ? level.createPackages() : { installed: [], available: [] };
    state.services = level.createServices ? level.createServices() : [];
    state.users = level.createUsers ? level.createUsers() : [];
    state.groups = level.createGroups ? level.createGroups() : [];
    state.firewall = level.createFirewall ? level.createFirewall() : { enabled: false, rules: [] };
    state.mounts = level.createMounts ? level.createMounts() : [];
    state.openFiles = level.createOpenFiles ? level.createOpenFiles() : [];
    state.aliases = level.createAliases ? level.createAliases() : {};

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

  function buildExecCtxFor(s) {
    return {
      vfs: s.vfs,
      getCwd: () => s.cwd,
      setCwd: (arr) => { s.cwd = arr; },
      env: s.env,
      currentUser: 'jugador',
      userGroups: ['jugador', 'sudo'],
      sudo: false,
      processes: s.processes,
      jobs: s.jobs,
      network: s.network,
      getUmask: () => s.umask,
      setUmask: (val) => { s.umask = val; },
      packages: s.packages,
      services: s.services,
      users: s.users,
      groups: s.groups,
      firewall: s.firewall,
      mounts: s.mounts,
      openFiles: s.openFiles,
      aliases: s.aliases,
    };
  }

  function buildExecCtx() {
    return buildExecCtxFor(activeState());
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
        packages: state.packages,
        services: state.services,
        users: state.users,
        groups: state.groups,
        firewall: state.firewall,
        mounts: state.mounts,
        openFiles: state.openFiles,
        aliases: state.aliases,
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
    const s = activeState();
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
      const dirPath = s.vfs.normalize(dirPart || '.', s.cwd);
      const dirNode = s.vfs.getNode(dirPath);
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
    if (state.mode === 'challenge') runChallengeCommandLine(val);
    else runCommandLine(val);
  }

  // --- Modo Desafío ---

  function updateStatsUI() {
    const c = state.challenge;
    els.challengeLives.textContent = '❤️'.repeat(Math.max(0, c.lives)) + '🖤'.repeat(Math.max(0, 3 - c.lives));
    els.challengeScore.textContent = c.score;
    els.challengeStreak.textContent = c.streak;
    els.challengeBest.textContent = c.best;
  }

  function updateTimerBar() {
    const c = state.challenge;
    const pct = c.timeLimit > 0 ? Math.max(0, Math.min(100, (c.timeLeft / c.timeLimit) * 100)) : 0;
    els.timerBarFill.style.width = `${pct}%`;
    els.timerBarFill.classList.toggle('warn', pct <= 50 && pct > 20);
    els.timerBarFill.classList.toggle('danger', pct <= 20);
  }

  function stopTimer() {
    const c = state.challenge;
    if (c.timerHandle) {
      clearInterval(c.timerHandle);
      c.timerHandle = null;
    }
  }

  function startTimer() {
    const c = state.challenge;
    stopTimer();
    c.timerHandle = setInterval(() => {
      if (state.mode !== 'challenge' || !c.active || c.resolved) return;
      c.timeLeft = Math.max(0, c.timeLeft - 0.1);
      updateTimerBar();
      if (c.timeLeft <= 0) onChallengeFail();
    }, 100);
  }

  function startChallengeRun() {
    const c = state.challenge;
    c.active = true;
    c.lives = 3;
    c.score = 0;
    c.streak = 0;
    c.best = loadBest();
    c.queue = TA.shuffleChallenges(CHALLENGES.map((_, i) => i));
    c.queuePos = 0;
    els.challengeIntro.style.display = 'none';
    els.challengeGameover.style.display = 'none';
    els.challengePanel.style.display = '';
    updateStatsUI();
    loadChallenge();
  }

  function loadChallenge() {
    const c = state.challenge;
    if (c.queuePos >= c.queue.length) {
      c.queue = TA.shuffleChallenges(CHALLENGES.map((_, i) => i));
      c.queuePos = 0;
    }
    const def = CHALLENGES[c.queue[c.queuePos]];
    const tier = TA.CHALLENGE_TIERS[def.tier];
    c.current = def;
    c.resolved = false;
    c.vfs = new TA.VFS(def.createFs());
    c.cwd = [...def.startCwd];
    c.env = def.createEnv ? def.createEnv() : {};
    c.processes = def.createProcesses ? def.createProcesses() : [];
    c.jobs = [];
    c.network = def.createNetwork ? def.createNetwork() : { routes: {}, hosts: {}, ports: [] };
    c.umask = def.initialUmask || '022';
    c.packages = def.createPackages ? def.createPackages() : { installed: [], available: [] };
    c.services = def.createServices ? def.createServices() : [];
    c.users = def.createUsers ? def.createUsers() : [];
    c.groups = def.createGroups ? def.createGroups() : [];
    c.firewall = def.createFirewall ? def.createFirewall() : { enabled: false, rules: [] };
    c.mounts = def.createMounts ? def.createMounts() : [];
    c.openFiles = def.createOpenFiles ? def.createOpenFiles() : [];
    c.aliases = def.createAliases ? def.createAliases() : {};
    c.history = [];
    c.visited = new Set();
    c.inputHistory = [];
    c.inputPointer = 0;
    c.timeLimit = tier.timeLimit;
    c.timeLeft = tier.timeLimit;

    els.challengeTierLabel.textContent = `🎯 Reto (${tier.label})`;
    els.challengeObjective.textContent = def.objective;
    updateTimerBar();
    updateStatsUI();

    els.output.innerHTML = '';
    printLine(`--- Reto: ${tier.label} ---`, 'term-meta');
    printLine(def.objective, 'term-meta');
    els.prompt.textContent = promptText();
    els.input.value = '';
    if (state.mode === 'challenge') els.input.focus();

    startTimer();
  }

  function onChallengeSuccess() {
    const c = state.challenge;
    if (c.resolved) return;
    c.resolved = true;
    stopTimer();
    const tier = TA.CHALLENGE_TIERS[c.current.tier];
    const speedBonus = Math.round((c.timeLeft / c.timeLimit) * tier.points * 0.5);
    const points = tier.points + speedBonus;
    c.score += points;
    c.streak += 1;
    updateStatsUI();
    printLine(`✅ ¡Correcto! +${points} puntos (racha ${c.streak})`, 'term-explain');
    c.queuePos += 1;
    setTimeout(() => { if (state.challenge.active) loadChallenge(); }, 900);
  }

  function onChallengeFail() {
    const c = state.challenge;
    if (c.resolved) return;
    c.resolved = true;
    stopTimer();
    c.lives -= 1;
    c.streak = 0;
    updateStatsUI();
    printLine('⏱️ ¡Se acabó el tiempo!', 'term-error');
    printLine(`💡 Una solución válida era: ${c.current.solution}`, 'term-explain');
    c.queuePos += 1;
    if (c.lives <= 0) {
      setTimeout(() => gameOver(), 1200);
    } else {
      setTimeout(() => { if (state.challenge.active) loadChallenge(); }, 1600);
    }
  }

  function gameOver() {
    const c = state.challenge;
    c.active = false;
    stopTimer();
    const best = Math.max(c.best, c.score);
    c.best = best;
    saveBest(best);
    els.challengePanel.style.display = 'none';
    els.challengeGameover.style.display = '';
    els.gameoverScore.textContent = c.score;
    els.gameoverBest.textContent = best;
  }

  function runChallengeCommandLine(raw) {
    const trimmed = raw.trim();
    if (trimmed === '') return;
    const c = state.challenge;

    printLine(`${promptText()} ${raw}`, 'term-input-echo');
    c.inputHistory.push(raw);
    c.inputPointer = c.inputHistory.length;

    if (trimmed === 'clear') {
      handleClear();
      return;
    }
    if (!c.active || !c.current || c.resolved) return;

    const ctx = buildExecCtx();
    const result = TA.Shell.runLine(trimmed, ctx);

    for (const stage of result.stages) {
      c.history.push({ ...stage, raw: trimmed });
      if (stage.cmd === 'cd' && !stage.error) {
        c.visited.add(c.vfs.pathToStr(c.cwd));
      }
    }

    if (!result.ok) {
      printBlock(result.output, 'term-error');
      printExplain(result.explain);
    } else {
      printBlock(result.output, 'term-output');
    }

    els.prompt.textContent = promptText();

    const passed = c.current.check({
      vfs: c.vfs,
      cwd: c.cwd,
      history: c.history,
      visited: c.visited,
      env: c.env,
      processes: c.processes,
      jobs: c.jobs,
      network: c.network,
      umask: c.umask,
      packages: c.packages,
      services: c.services,
      users: c.users,
      groups: c.groups,
      firewall: c.firewall,
      mounts: c.mounts,
      openFiles: c.openFiles,
      aliases: c.aliases,
    });
    if (passed) onChallengeSuccess();
  }

  function switchMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    els.tabLearn.classList.toggle('active', mode === 'learn');
    els.tabChallenge.classList.toggle('active', mode === 'challenge');
    els.appMain.classList.toggle('challenge-mode', mode === 'challenge');

    if (mode === 'learn') {
      stopTimer();
      els.learnPanel.style.display = '';
      els.challengeIntro.style.display = 'none';
      els.challengePanel.style.display = 'none';
      els.challengeGameover.style.display = 'none';
      els.output.innerHTML = '';
      const level = LEVELS[state.levelIndex];
      printLine(`--- ${level.title} ---`, 'term-meta');
      printLine(level.story, 'term-meta');
      printLine('Escribe "help" para ver los comandos disponibles. Tab autocompleta, Ctrl+L limpia la pantalla.', 'term-meta');
      els.prompt.textContent = promptText();
    } else {
      els.learnPanel.style.display = 'none';
      els.challengeGameover.style.display = 'none';
      const c = state.challenge;
      if (c.active && c.current) {
        els.challengeIntro.style.display = 'none';
        els.challengePanel.style.display = '';
        els.output.innerHTML = '';
        const tier = TA.CHALLENGE_TIERS[c.current.tier];
        printLine(`--- Reto: ${tier.label} ---`, 'term-meta');
        printLine(c.current.objective, 'term-meta');
        els.prompt.textContent = promptText();
        if (!c.resolved) startTimer();
      } else {
        els.challengePanel.style.display = 'none';
        els.challengeIntro.style.display = '';
        els.challengeBestIntro.textContent = loadBest();
      }
    }
    els.input.value = '';
    els.input.focus();
  }

  function historyBack() {
    const s = activeState();
    if (s.inputHistory.length === 0) return;
    s.inputPointer = Math.max(0, s.inputPointer - 1);
    els.input.value = s.inputHistory[s.inputPointer] || '';
  }

  function historyForward() {
    const s = activeState();
    if (s.inputHistory.length === 0) return;
    s.inputPointer = Math.min(s.inputHistory.length, s.inputPointer + 1);
    els.input.value = s.inputHistory[s.inputPointer] || '';
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

    els.tabLearn.addEventListener('click', () => switchMode('learn'));
    els.tabChallenge.addEventListener('click', () => switchMode('challenge'));
    els.challengeStartBtn.addEventListener('click', startChallengeRun);
    els.challengeRestartBtn.addEventListener('click', startChallengeRun);
    els.challengeToLearnBtn.addEventListener('click', () => switchMode('learn'));

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
    state.challenge.best = loadBest();
    bindEvents();
    const firstUnfinished = LEVELS.findIndex((_, i) => !state.completed.has(i));
    loadLevel(firstUnfinished === -1 ? LEVELS.length - 1 : firstUnfinished);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
