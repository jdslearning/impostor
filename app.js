/* ==========================================================================
   Impostor Musical — lógica principal
   ========================================================================== */

(function () {
  'use strict';

  // --- Estado global ------------------------------------------------------
  const state = {
    mode: 'musical',      // musical | classic
    players: [],          // [{ id, name, role, alive }]
    secretItem: null,     // canción/palabra de los civiles
    revealIndex: 0,       // índice del jugador en la fase de reparto
    duration: 60,         // segundos por ronda
    timeLeft: 60,
    timerHandle: null,
    timerPaused: false,
    accusedId: null,
    rounds: 0,
    classicHintsEnabled: true,
    conversationStarter: null,
  };

  // --- Utilidades ---------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // --- Modos y catálogos -------------------------------------------------
  // Las canciones usan "Título - Artista"; las palabras usan "Palabra | pista".
  // La fuente puede ser localStorage o los archivos por defecto del repositorio.
  const MODE_KEY = 'impostor.gameMode';
  const CLASSIC_HINTS_KEY = 'impostor.classicHintsEnabled';
  const SONGS_KEY = 'impostor.songsText';
  const WORDS_KEY = 'impostor.wordsText';
  const catalogs = {
    musical: [],
    classic: [],
  };

  const MODES = {
    musical: {
      icon: '🎵',
      title: 'Impostor Musical',
      subtitle: 'Encuentra al impostor en la pista de baile',
      editLabel: '✏️ Editar canciones',
      editHref: 'editor.html?type=songs',
      storageKey: SONGS_KEY,
      defaultFile: 'songs.txt',
      emptyError: 'No se han podido cargar las canciones.',
      readyTitle: '¡Todos listos!',
      readyIntro: 'Buscad la canción en vuestro móvil, poneos los auriculares y… 💃🕺',
      readyRules: [
        '🎧 Civiles: bailad <strong>vuestra canción secreta</strong>.',
        '🤫 Impostores: poned cualquier canción y disimulad.',
        '👀 Observad a los demás. ¿Quién baila raro?',
      ],
      startLabel: 'Empezar a bailar',
      timerLabel: '¡A bailar!',
      secretSummary: '🎵 Canción secreta',
      footnote: 'Pasa el móvil de jugador en jugador. Cada uno girará la tarjeta para descubrir su canción secreta.',
    },
    classic: {
      icon: '🧩',
      title: 'Impostor Clásico',
      subtitle: 'Descubre quién habla sin conocer la palabra',
      editLabel: '✏️ Editar palabras',
      editHref: 'editor.html?type=words',
      storageKey: WORDS_KEY,
      defaultFile: 'words.txt',
      emptyError: 'No se han podido cargar las palabras.',
      readyTitle: '¡Palabra repartida!',
      readyIntro: 'Por turnos, dad pistas sin decir la palabra exacta.',
      readyRules: [
        '💬 Civiles: dad pistas sutiles sobre <strong>la palabra secreta</strong>.',
        '🤫 Impostores: usad vuestra pista y fingid que sabéis la palabra.',
        '👀 Observad dudas, pistas demasiado vagas o conexiones raras.',
      ],
      startLabel: 'Empezar ronda',
      timerLabel: '¡A hablar!',
      secretSummary: '🧩 Palabra secreta',
      footnote: 'Pasa el móvil de jugador en jugador. Cada uno girará la tarjeta para descubrir su palabra o pista.',
    },
  };

  const savedMode = localStorage.getItem(MODE_KEY);
  if (MODES[savedMode]) state.mode = savedMode;
  state.classicHintsEnabled = localStorage.getItem(CLASSIC_HINTS_KEY) !== 'false';

  function parseSongs(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(line => {
        const i = line.indexOf(' - ');
        const title = i >= 0 ? line.slice(0, i).trim() : line;
        const artist = i >= 0 ? line.slice(i + 3).trim() : '';
        return { title, detail: artist, hint: '', emoji: '🎵' };
      })
      .filter(s => s.title);
  }

  function parseWords(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(line => {
        const i = line.indexOf('|');
        const title = i >= 0 ? line.slice(0, i).trim() : line;
        const hint = i >= 0 ? line.slice(i + 1).trim() : '';
        return { title, detail: '', hint, emoji: '🧩' };
      })
      .filter(s => s.title);
  }

  function parseCatalog(mode, text) {
    return mode === 'classic' ? parseWords(text) : parseSongs(text);
  }

  async function loadCatalog(mode = state.mode) {
    const config = MODES[mode];
    const stored = localStorage.getItem(config.storageKey);
    if (stored) {
      const parsed = parseCatalog(mode, stored);
      if (parsed.length > 0) {
        catalogs[mode] = parsed;
        return catalogs[mode];
      }
    }
    try {
      const res = await fetch(config.defaultFile, { cache: 'no-cache' });
      const text = await res.text();
      catalogs[mode] = parseCatalog(mode, text);
    } catch (_) {
      catalogs[mode] = [];
    }
    return catalogs[mode];
  }

  // Arrancamos la carga inmediatamente para que esté lista al iniciar partida.
  loadCatalog(state.mode);

  function pickSecretItem() {
    const items = catalogs[state.mode];
    if (!items || items.length === 0) return null;
    return items[Math.floor(Math.random() * items.length)];
  }

  // Sugerencia de impostores en función del número de jugadores.
  function recommendImpostors(n) {
    if (n <= 5) return '1';
    if (n <= 7) return '1-2';
    if (n <= 9) return '2';
    if (n <= 11) return '2-3';
    return '3-4';
  }

  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  function currentMode() {
    return MODES[state.mode];
  }

  function classicSetupDuration() {
    const players = clamp(parseInt(playersInput.value, 10) || 3, 3, 20);
    return players * 30;
  }

  function syncClassicDuration() {
    if (state.mode !== 'classic') return;
    durationInput.value = classicSetupDuration();
  }

  function updateClassicRules() {
    if (state.mode !== 'classic') return;
    const impostorRule = state.classicHintsEnabled
      ? '🤫 Impostores: usad vuestra pista y fingid que sabéis la palabra.'
      : '🤫 Impostores: no recibís pista. Escuchad bien y fingid que sabéis la palabra.';
    $('#ready-rules').innerHTML = [
      '💬 Civiles: dad pistas sutiles sobre <strong>la palabra secreta</strong>.',
      impostorRule,
      '👀 Observad dudas, pistas demasiado vagas o conexiones raras.',
    ].map(rule => `<li>${rule}</li>`).join('');
    $('#setup-footnote').textContent = state.classicHintsEnabled
      ? 'Pasa el móvil de jugador en jugador. Cada uno girará la tarjeta para descubrir su palabra o pista.'
      : 'Pasa el móvil de jugador en jugador. Los civiles verán la palabra y los impostores solo su rol.';
  }

  function updateModeUi() {
    const mode = currentMode();
    $('#mode-icon').textContent = mode.icon;
    $('#mode-title').textContent = mode.title;
    $('#mode-subtitle').textContent = mode.subtitle;
    $('#edit-catalog-link').textContent = mode.editLabel;
    $('#edit-catalog-link').href = mode.editHref;
    $('#ready-title').textContent = mode.readyTitle;
    $('#ready-intro').textContent = mode.readyIntro;
    $('#ready-rules').innerHTML = mode.readyRules.map(rule => `<li>${rule}</li>`).join('');
    $('#btn-start-timer').textContent = mode.startLabel;
    $('#timer-label').textContent = mode.timerLabel;
    $('#setup-footnote').textContent = mode.footnote;
    $('#classic-hint-field').hidden = state.mode !== 'classic';
    $('#duration-label').innerHTML = state.mode === 'classic'
      ? 'Duración de la ronda <em class="hint">(30 s por jugador)</em>'
      : 'Duración de la ronda (segundos)';
    syncClassicDuration();
    updateClassicRules();
    document.title = mode.title;
  }

  async function toggleMode() {
    state.mode = state.mode === 'musical' ? 'classic' : 'musical';
    localStorage.setItem(MODE_KEY, state.mode);
    updateModeUi();
    await loadCatalog(state.mode);
  }

  // --- Configuración ------------------------------------------------------
  const playersInput = $('#input-players');
  const impostorsInput = $('#input-impostors');
  const durationInput = $('#input-duration');
  const classicHintsInput = $('#input-classic-hints');
  const namesList = $('#names-list');
  const setupError = $('#setup-error');
  const modeToggle = $('#btn-mode-toggle');

  modeToggle.addEventListener('click', toggleMode);
  classicHintsInput.checked = state.classicHintsEnabled;
  classicHintsInput.addEventListener('change', () => {
    state.classicHintsEnabled = classicHintsInput.checked;
    localStorage.setItem(CLASSIC_HINTS_KEY, String(state.classicHintsEnabled));
    updateClassicRules();
  });

  function getStepBounds(name) {
    if (name === 'players') return { min: 3, max: 20 };
    if (name === 'impostors') return { min: 1, max: 19 };
    if (name === 'duration') return { min: 15, max: 900 };
    return { min: 0, max: 999 };
  }

  function syncImpostorMax() {
    const players = parseInt(playersInput.value, 10) || 3;
    // Tope técnico: tiene que quedar al menos un civil.
    const maxImps = Math.max(1, players - 1);
    impostorsInput.max = maxImps;
    if (parseInt(impostorsInput.value, 10) > maxImps) {
      impostorsInput.value = maxImps;
    }
    const hint = document.getElementById('impostor-hint');
    if (hint) {
      hint.textContent = `(recomendado: ${recommendImpostors(players)})`;
    }
  }

  function renderNameInputs() {
    const count = clamp(parseInt(playersInput.value, 10) || 3, 3, 20);
    const existing = $$('input', namesList).map(i => i.value);
    namesList.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = `Jugador ${i + 1}`;
      input.maxLength = 20;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.value = existing[i] || '';
      namesList.appendChild(input);
    }
  }

  $$('.stepper').forEach(stepper => {
    const name = stepper.dataset.stepper;
    const input = stepper.querySelector('input');
    const { min, max } = getStepBounds(name);

    stepper.querySelectorAll('.step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.dataset.step, 10);
        const cur = parseInt(input.value, 10) || min;
        const dynMax = parseInt(input.max, 10) || max;
        input.value = clamp(cur + delta, min, dynMax);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    // Actualización en vivo (cada pulsación / cambio del valor)
    const onInput = () => {
      if (name === 'players') {
        // Sólo recalculamos hint/max — no recreamos los nombres en cada pulsación
        // para no perder el foco mientras el usuario escribe.
        syncImpostorMax();
      }
    };
    const onChange = () => {
      const dynMax = parseInt(input.max, 10) || max;
      input.value = clamp(parseInt(input.value, 10) || min, min, dynMax);
      if (name === 'players') {
        renderNameInputs();
        syncImpostorMax();
        syncClassicDuration();
      }
    };
    input.addEventListener('input', onInput);
    input.addEventListener('change', onChange);
  });

  $('#btn-start').addEventListener('click', startGame);

  async function startGame() {
    const numPlayers = parseInt(playersInput.value, 10);
    const numImpostors = parseInt(impostorsInput.value, 10);
    const duration = parseInt(durationInput.value, 10);

    const nameInputs = $$('input', namesList);
    const names = nameInputs.map(i => i.value.trim());
    const firstEmpty = names.findIndex(n => !n);
    if (firstEmpty >= 0) {
      nameInputs[firstEmpty].focus();
      return setError('Falta el nombre del jugador ' + (firstEmpty + 1) + '.');
    }
    const lower = names.map(n => n.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      return setError('Los nombres deben ser únicos.');
    }
    if (numImpostors >= numPlayers) {
      return setError('Tiene que haber al menos un civil.');
    }

    // Asegurar que el catálogo del modo esté disponible.
    if (!catalogs[state.mode] || catalogs[state.mode].length === 0) await loadCatalog(state.mode);
    if (!catalogs[state.mode] || catalogs[state.mode].length === 0) {
      return setError(currentMode().emptyError);
    }

    setError(null);

    // Roles: barajar índices y los primeros N son impostores
    const roleAssignments = shuffle(names.map((_, i) => i));
    const impostorIdx = new Set(roleAssignments.slice(0, numImpostors));

    state.players = names.map((name, i) => ({
      id: i,
      name,
      role: impostorIdx.has(i) ? 'impostor' : 'civil',
      alive: true,
    }));
    state.secretItem = pickSecretItem();
    state.duration = duration;
    state.timeLeft = duration;
    state.revealIndex = 0;
    state.rounds = 0;
    state.conversationStarter = null;

    // Barajamos el orden de reparto para que no coincida con el orden de la lista
    state.revealOrder = shuffle(state.players.map(p => p.id));

    showScreen('screen-pass');
    renderPass();
  }

  function setError(msg) {
    if (!msg) {
      setupError.hidden = true;
      setupError.textContent = '';
      setupError.classList.remove('shake');
    } else {
      setupError.hidden = false;
      setupError.textContent = msg;
      setupError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Reanima la sacudida cada vez que cambia el mensaje
      setupError.classList.remove('shake');
      // Forzar reflow para reiniciar la animación
      void setupError.offsetWidth;
      setupError.classList.add('shake');
    }
  }

  // --- Fase de reparto ----------------------------------------------------
  function currentPlayer() {
    const id = state.revealOrder[state.revealIndex];
    return state.players.find(p => p.id === id);
  }

  function renderPass() {
    const player = currentPlayer();
    $('#pass-name').textContent = player.name;
    $('#pass-progress').textContent =
      `Jugador ${state.revealIndex + 1} de ${state.players.length}`;
    showScreen('screen-pass');
  }

  $('#btn-im-here').addEventListener('click', () => {
    renderReveal();
    showScreen('screen-reveal');
  });

  // --- Reveal con tarjeta que gira ---------------------------------------
  const flipCard = $('#flip-card');
  const flipName = $('#flip-name');
  const revealContent = $('#reveal-content');
  const btnNext = $('#btn-next-player');

  let hasSeen = false;

  function renderReveal() {
    const player = currentPlayer();
    flipName.textContent = player.name;

    // Reset estado
    flipCard.classList.remove('flipped');
    hasSeen = false;
    btnNext.disabled = true;
    btnNext.textContent =
      state.revealIndex === state.players.length - 1
        ? 'Listo, empezar a jugar'
        : 'Siguiente jugador';

    // Contenido secreto
    revealContent.classList.remove('civil', 'impostor');
    if (player.role === 'impostor') {
      revealContent.classList.add('impostor');
      if (state.mode === 'classic') {
        if (state.classicHintsEnabled) {
          revealContent.innerHTML = `
            <div class="role-label">Tu pista</div>
            <div class="role-title">🤫 Eres el impostor</div>
            <h3 class="song-title">${escapeHtml(state.secretItem.hint || 'Pista ambigua')}</h3>
            <p class="impostor-msg">
              No conoces la palabra exacta. Usa esta pista para disimular.
            </p>
          `;
        } else {
          revealContent.innerHTML = `
            <div class="role-label">Tu rol</div>
            <div class="role-title">🤫 Eres el impostor</div>
            <p class="impostor-msg">
              No conoces la palabra exacta y no tienes pista. Escucha a los demás
              y trata de encajar.
            </p>
          `;
        }
      } else {
        revealContent.innerHTML = `
          <div class="role-label">Tu rol</div>
          <div class="role-title">🤫 Eres el impostor</div>
          <p class="impostor-msg">
            No conoces la canción. Pon lo que quieras y trata de imitar
            a los demás bailarines.
          </p>
          <p class="impostor-msg">
            ¡Que no te pillen!
          </p>
        `;
      }
    } else {
      revealContent.classList.add('civil');
      if (state.mode === 'classic') {
        revealContent.innerHTML = `
          <div class="role-label">Tu palabra secreta</div>
          <div class="song-emoji">${state.secretItem.emoji}</div>
          <h3 class="song-title">${escapeHtml(state.secretItem.title)}</h3>
          <p class="impostor-msg">Da pistas sutiles. Si eres demasiado obvio, ayudas al impostor.</p>
        `;
      } else {
        revealContent.innerHTML = `
          <div class="role-label">Tu canción secreta</div>
          <div class="song-emoji">${state.secretItem.emoji}</div>
          <h3 class="song-title">${escapeHtml(state.secretItem.title)}</h3>
          <p class="song-artist">${escapeHtml(state.secretItem.detail)}</p>
          <p class="impostor-msg">Búscala en tu móvil y baila como nadie.</p>
        `;
      }
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function toggleFlip() {
    const willBeFlipped = !flipCard.classList.contains('flipped');
    flipCard.classList.toggle('flipped', willBeFlipped);
    if (willBeFlipped) {
      hasSeen = true;
    } else if (hasSeen) {
      // Vio el secreto y volvió a esconderlo: desbloquea "Siguiente"
      btnNext.disabled = false;
    }
  }

  flipCard.addEventListener('click', toggleFlip);
  flipCard.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleFlip();
    }
  });

  btnNext.addEventListener('click', () => {
    state.revealIndex++;
    if (state.revealIndex >= state.players.length) {
      showScreen('screen-ready');
    } else {
      renderPass();
    }
  });

  // --- Pantalla "listos" --------------------------------------------------
  $('#btn-start-timer').addEventListener('click', () => {
    if (state.mode === 'classic') {
      state.duration = aliveCount() * 30;
      state.conversationStarter = pickConversationStarter();
    }
    state.timeLeft = state.duration;
    startTimer();
    showScreen('screen-timer');
  });

  // --- Temporizador -------------------------------------------------------
  const timerDisplay = $('#timer-display');
  const timerBar = $('#timer-bar');
  const btnTimerToggle = $('#btn-timer-toggle');

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function renderTimer() {
    timerDisplay.textContent = formatTime(state.timeLeft);
    const pct = (state.timeLeft / state.duration) * 100;
    timerBar.style.width = `${pct}%`;
    timerDisplay.classList.toggle('warning', state.timeLeft <= 10);
  }

  function pickConversationStarter() {
    const alive = state.players.filter(p => p.alive);
    if (!alive.length) return null;
    return alive[Math.floor(Math.random() * alive.length)].name;
  }

  function updateTimerLabel() {
    if (state.mode === 'classic') {
      $('#timer-label').textContent = state.conversationStarter
        ? `Empieza hablando: ${state.conversationStarter}`
        : 'Empieza la conversación';
    } else {
      $('#timer-label').textContent = currentMode().timerLabel;
    }
  }

  function startTimer() {
    clearInterval(state.timerHandle);
    state.timerPaused = false;
    btnTimerToggle.textContent = 'Pausar';
    updateTimerLabel();
    renderTimer();
    state.timerHandle = setInterval(() => {
      if (state.timerPaused) return;
      state.timeLeft--;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        renderTimer();
        clearInterval(state.timerHandle);
        state.timerHandle = null;
        playBeep();
        setTimeout(goToVote, 600);
        return;
      }
      renderTimer();
      if (state.timeLeft <= 10) playTick();
    }, 1000);
  }

  btnTimerToggle.addEventListener('click', () => {
    state.timerPaused = !state.timerPaused;
    btnTimerToggle.textContent = state.timerPaused ? 'Reanudar' : 'Pausar';
  });

  $('#btn-timer-skip').addEventListener('click', () => {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
    goToVote();
  });

  // --- Audio (beep simple con Web Audio API) ------------------------------
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    return audioCtx;
  }
  function tone(freq, duration, vol = 0.15) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  }
  function playTick() { tone(880, 0.08); }
  function playBeep() {
    tone(440, 0.25);
    setTimeout(() => tone(660, 0.4), 220);
  }

  // --- Votación / acusación ----------------------------------------------
  function goToVote() {
    state.rounds++;
    renderVote();
    showScreen('screen-vote');
  }

  function aliveCount(role) {
    return state.players.filter(p => p.alive && (!role || p.role === role)).length;
  }

  function renderVote() {
    const status = $('#vote-status');
    const civils = aliveCount('civil');
    const imps = aliveCount('impostor');
    status.textContent = `Quedan ${civils} ${civils === 1 ? 'civil' : 'civiles'} y ${imps} ${imps === 1 ? 'impostor' : 'impostores'}`;

    const list = $('#vote-list');
    list.innerHTML = '';
    state.players.filter(p => p.alive).forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'vote-btn';
      btn.type = 'button';
      btn.textContent = p.name;
      btn.addEventListener('click', () => onVote(p.id));
      list.appendChild(btn);
    });

    $('#vote-result').hidden = true;
    state.accusedId = null;
  }

  function onVote(id) {
    state.accusedId = id;
    const player = state.players.find(p => p.id === id);
    player.alive = false;

    const card = $('#vote-result-card');
    card.classList.remove('civil', 'impostor');
    card.classList.add(player.role);

    $('#vote-result-text').textContent =
      player.role === 'impostor'
        ? `🎯 ¡${player.name} era IMPOSTOR!`
        : `😱 ${player.name} era civil...`;

    $('#vote-result-detail').textContent =
      player.role === 'impostor'
        ? '¡Buena cazada! Continúa la partida si todavía hay impostores escondidos.'
        : 'Ay... el grupo se equivocó. Toca seguir buscando.';

    $('#vote-list').innerHTML = '';
    $('#vote-result').hidden = false;
  }

  $('#btn-vote-continue').addEventListener('click', () => {
    const winner = checkWinCondition();
    if (winner) return endGame(winner);

    // Volver a la siguiente ronda
    state.timeLeft = state.duration;
    showScreen('screen-ready');
  });

  function checkWinCondition() {
    const civils = aliveCount('civil');
    const imps = aliveCount('impostor');
    if (imps === 0) return 'civils';
    if (imps >= civils) return 'impostors';
    return null;
  }

  // --- Pantalla final -----------------------------------------------------
  function endGame(winner) {
    const emoji = $('#end-emoji');
    const title = $('#end-title');
    const detail = $('#end-detail');
    const summary = $('#end-summary');

    if (winner === 'civils') {
      emoji.textContent = '🎉';
      title.textContent = '¡Ganan los civiles!';
      detail.textContent = 'Habéis cazado a todos los impostores.';
    } else {
      emoji.textContent = '🕵️';
      title.textContent = '¡Ganan los impostores!';
      detail.textContent = 'Han logrado sobrevivir a la pista de baile.';
    }

    summary.innerHTML = '';
    const songRow = document.createElement('div');
    songRow.className = 'summary-row';
    songRow.innerHTML = `
      <span>${currentMode().secretSummary}</span>
      <strong>${escapeHtml(state.secretItem.title)}</strong>
    `;
    summary.appendChild(songRow);

    state.players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'summary-row';
      row.innerHTML = `
        <span>${escapeHtml(p.name)}</span>
        <span>
          <span class="badge ${p.role}">${p.role === 'impostor' ? 'Impostor' : 'Civil'}</span>
          <span class="badge ${p.alive ? 'alive' : 'eliminated'}">${p.alive ? 'En pie' : 'Linchado'}</span>
        </span>
      `;
      summary.appendChild(row);
    });

    showScreen('screen-end');
  }

  $('#btn-play-again').addEventListener('click', () => {
    // Mismos jugadores y configuración, nuevos roles y canción
    const names = state.players.map(p => p.name);
    const numImpostors = state.players.filter(p => p.role === 'impostor').length;
    const roleAssignments = shuffle(names.map((_, i) => i));
    const impostorIdx = new Set(roleAssignments.slice(0, numImpostors));

    state.players = names.map((name, i) => ({
      id: i,
      name,
      role: impostorIdx.has(i) ? 'impostor' : 'civil',
      alive: true,
    }));
    state.secretItem = pickSecretItem();
    state.timeLeft = state.duration;
    state.revealIndex = 0;
    state.rounds = 0;
    state.conversationStarter = null;
    state.revealOrder = shuffle(state.players.map(p => p.id));

    renderPass();
  });

  $('#btn-new-game').addEventListener('click', () => {
    showScreen('screen-setup');
  });

  // --- Init ---------------------------------------------------------------
  updateModeUi();
  renderNameInputs();
  syncImpostorMax();

  // Desbloquear el contexto de audio en la primera interacción
  document.addEventListener('click', () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }, { once: true });
})();
