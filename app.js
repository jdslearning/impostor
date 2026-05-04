/* ==========================================================================
   Impostor Musical — lógica principal
   ========================================================================== */

(function () {
  'use strict';

  // --- Estado global ------------------------------------------------------
  const state = {
    players: [],          // [{ id, name, role, alive }]
    song: null,           // canción de los civiles
    revealIndex: 0,       // índice del jugador en la fase de reparto
    duration: 60,         // segundos por ronda
    timeLeft: 60,
    timerHandle: null,
    timerPaused: false,
    accusedId: null,
    rounds: 0,
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

  function pickSong() {
    return SONGS[Math.floor(Math.random() * SONGS.length)];
  }

  function showScreen(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  // --- Configuración ------------------------------------------------------
  const playersInput = $('#input-players');
  const impostorsInput = $('#input-impostors');
  const durationInput = $('#input-duration');
  const namesList = $('#names-list');
  const setupError = $('#setup-error');

  function getStepBounds(name) {
    if (name === 'players') return { min: 3, max: 20 };
    if (name === 'impostors') return { min: 1, max: 5 };
    if (name === 'duration') return { min: 15, max: 300 };
    return { min: 0, max: 999 };
  }

  function syncImpostorMax() {
    const players = parseInt(playersInput.value, 10) || 3;
    const maxImps = Math.max(1, Math.floor((players - 1) / 2));
    impostorsInput.max = maxImps;
    if (parseInt(impostorsInput.value, 10) > maxImps) {
      impostorsInput.value = maxImps;
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
        input.dispatchEvent(new Event('change'));
      });
    });

    input.addEventListener('change', () => {
      const dynMax = parseInt(input.max, 10) || max;
      input.value = clamp(parseInt(input.value, 10) || min, min, dynMax);
      if (name === 'players') {
        renderNameInputs();
        syncImpostorMax();
      }
    });
  });

  $('#btn-start').addEventListener('click', startGame);

  function startGame() {
    const numPlayers = parseInt(playersInput.value, 10);
    const numImpostors = parseInt(impostorsInput.value, 10);
    const duration = parseInt(durationInput.value, 10);

    const names = $$('input', namesList).map(i => i.value.trim());
    if (names.some(n => !n)) {
      return setError('Cada jugador necesita un nombre.');
    }
    const lower = names.map(n => n.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      return setError('Los nombres deben ser únicos.');
    }
    if (numImpostors >= numPlayers) {
      return setError('Tiene que haber al menos un civil.');
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
    state.song = pickSong();
    state.duration = duration;
    state.timeLeft = duration;
    state.revealIndex = 0;
    state.rounds = 0;

    // Barajamos el orden de reparto para que no coincida con el orden de la lista
    state.revealOrder = shuffle(state.players.map(p => p.id));

    showScreen('screen-pass');
    renderPass();
  }

  function setError(msg) {
    if (!msg) {
      setupError.hidden = true;
      setupError.textContent = '';
    } else {
      setupError.hidden = false;
      setupError.textContent = msg;
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

  // --- Reveal con tarjeta deslizable -------------------------------------
  const revealFront = $('#reveal-front');
  const revealBack = $('#reveal-back');
  const revealContent = $('#reveal-content');
  const revealFrontName = $('#reveal-front-name');
  const btnNext = $('#btn-next-player');

  let drag = null; // estado de gesture

  function renderReveal() {
    const player = currentPlayer();
    revealFrontName.textContent = player.name;

    // Reseteamos la tarjeta
    revealFront.classList.remove('revealed');
    revealFront.style.transform = '';
    btnNext.disabled = true;
    btnNext.textContent =
      state.revealIndex === state.players.length - 1
        ? 'Listo, empezar a jugar'
        : 'Siguiente jugador';

    // Contenido secreto
    revealContent.classList.remove('civil', 'impostor');
    if (player.role === 'impostor') {
      revealContent.classList.add('impostor');
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
    } else {
      revealContent.classList.add('civil');
      revealContent.innerHTML = `
        <div class="role-label">Tu canción secreta</div>
        <div class="song-emoji">${state.song.emoji}</div>
        <h3 class="song-title">${escapeHtml(state.song.title)}</h3>
        <p class="song-artist">${escapeHtml(state.song.artist)}</p>
        <p class="impostor-msg">Búscala en tu móvil y baila como nadie.</p>
      `;
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function onDragStart(e) {
    const point = getPoint(e);
    if (!point) return;
    drag = {
      startY: point.y,
      currentY: point.y,
      revealedAtStart: revealFront.classList.contains('revealed'),
    };
    revealFront.classList.add('dragging');
  }

  function onDragMove(e) {
    if (!drag) return;
    const point = getPoint(e);
    if (!point) return;
    drag.currentY = point.y;
    const delta = drag.currentY - drag.startY;
    const height = revealFront.offsetHeight;

    let translate;
    if (drag.revealedAtStart) {
      // Si estaba abierta, sólo permitimos mover hacia abajo (volver a tapar)
      translate = -height + Math.max(0, delta);
      translate = Math.min(0, translate);
    } else {
      // Si estaba cerrada, sólo hacia arriba (revelar)
      translate = Math.min(0, delta);
      translate = Math.max(-height, translate);
    }
    revealFront.style.transform = `translateY(${translate}px)`;
    if (e.cancelable) e.preventDefault();
  }

  function onDragEnd() {
    if (!drag) return;
    revealFront.classList.remove('dragging');
    const delta = drag.currentY - drag.startY;
    const height = revealFront.offsetHeight;
    const threshold = height * 0.25;

    let revealed;
    if (drag.revealedAtStart) {
      // Volver a cerrar si arrastró suficientemente hacia abajo
      revealed = !(delta > threshold);
    } else {
      revealed = (-delta) > threshold;
    }

    revealFront.style.transform = '';
    revealFront.classList.toggle('revealed', revealed);

    // El "siguiente" se habilita una vez vista la canción y vuelta a tapar
    if (drag.revealedAtStart && !revealed) {
      btnNext.disabled = false;
    }

    drag = null;
  }

  function getPoint(e) {
    if (e.touches && e.touches[0]) return { y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches[0]) return { y: e.changedTouches[0].clientY };
    if (typeof e.clientY === 'number') return { y: e.clientY };
    return null;
  }

  revealFront.addEventListener('touchstart', onDragStart, { passive: true });
  revealFront.addEventListener('touchmove', onDragMove, { passive: false });
  revealFront.addEventListener('touchend', onDragEnd);
  revealFront.addEventListener('touchcancel', onDragEnd);

  revealFront.addEventListener('mousedown', e => {
    onDragStart(e);
    const move = ev => onDragMove(ev);
    const up = ev => {
      onDragEnd(ev);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
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

  function startTimer() {
    clearInterval(state.timerHandle);
    state.timerPaused = false;
    btnTimerToggle.textContent = 'Pausar';
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

    // Volver a bailar otra ronda
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
      <span>🎵 Canción secreta</span>
      <strong>${escapeHtml(state.song.title)}</strong>
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
    state.song = pickSong();
    state.timeLeft = state.duration;
    state.revealIndex = 0;
    state.rounds = 0;
    state.revealOrder = shuffle(state.players.map(p => p.id));

    renderPass();
  });

  $('#btn-new-game').addEventListener('click', () => {
    showScreen('screen-setup');
  });

  // --- Init ---------------------------------------------------------------
  renderNameInputs();
  syncImpostorMax();

  // Desbloquear el contexto de audio en la primera interacción
  document.addEventListener('click', () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }, { once: true });
})();
