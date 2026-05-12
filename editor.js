/* ==========================================================================
   Impostor — editor de catálogos (sin contraseña, formato texto)
   ========================================================================== */

(function () {
  'use strict';

  const CATALOGS = {
    songs: {
      title: '🎵 Canciones',
      pageTitle: 'Editor de canciones · Impostor',
      storageKey: 'impostor.songsText',
      defaultFile: 'songs.txt',
      noun: 'canciones',
      help: 'Una canción por línea, con el formato Título - Artista. Edita libremente y pulsa Guardar.',
      placeholder: 'Despacito - Luis Fonsi\nMacarena - Los del Río\n...',
    },
    words: {
      title: '🧩 Palabras',
      pageTitle: 'Editor de palabras · Impostor',
      storageKey: 'impostor.wordsText',
      defaultFile: 'words.txt',
      noun: 'palabras',
      help: 'Una palabra por línea, con el formato Palabra | pista ambigua para el impostor. Edita libremente y pulsa Guardar.',
      placeholder: 'París | baguette\nElefante | gris\nCuchara | sopa\n...',
    },
  };

  const $ = (sel) => document.querySelector(sel);
  const params = new URLSearchParams(window.location.search);
  const type = CATALOGS[params.get('type')] ? params.get('type') : 'songs';
  const config = CATALOGS[type];
  const textarea = $('#catalog-text');
  const status = $('#editor-status');

  let dirty = false;

  // -------- Inicialización -----------------------------------------------
  init();

  async function init() {
    $('#editor-title').textContent = config.title;
    $('#editor-help').textContent = config.help;
    textarea.placeholder = config.placeholder;
    document.title = config.pageTitle;

    const stored = localStorage.getItem(config.storageKey);
    if (stored != null) {
      textarea.value = stored;
      setStatus(`Lista personalizada · ${countItems(stored)} ${config.noun}`, '');
    } else {
      await loadDefaults({ silent: true });
    }
  }

  async function loadDefaults({ silent = false } = {}) {
    try {
      const res = await fetch(config.defaultFile, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      textarea.value = text.replace(/\s+$/, '') + '\n';
      if (!silent) {
        setStatus(`Lista por defecto restaurada · ${countItems(text)} ${config.noun}`, 'saved');
      } else {
        setStatus(`Lista por defecto · ${countItems(text)} ${config.noun}`, '');
      }
    } catch (e) {
      setStatus('No se pudo cargar la lista por defecto: ' + e.message, 'dirty');
    }
  }

  // -------- Helpers -------------------------------------------------------
  function countItems(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .length;
  }

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = 'editor-status' + (kind ? ' ' + kind : '');
  }

  function markDirty() {
    dirty = true;
    setStatus(`Cambios sin guardar · ${countItems(textarea.value)} ${config.noun}`, 'dirty');
  }

  // -------- Eventos -------------------------------------------------------
  textarea.addEventListener('input', markDirty);

  $('#btn-save').addEventListener('click', () => {
    const text = textarea.value;
    if (countItems(text) === 0) {
      if (!confirm('La lista está vacía. ¿Seguro que quieres guardar?')) return;
    }
    try {
      localStorage.setItem(config.storageKey, text);
      dirty = false;
      setStatus(`Guardado · ${countItems(text)} ${config.noun}`, 'saved');
    } catch (e) {
      alert('No se pudo guardar: ' + e.message);
    }
  });

  $('#btn-restore').addEventListener('click', async () => {
    const msg = dirty
      ? 'Tienes cambios sin guardar y vas a perderlos. ¿Restaurar la lista por defecto?'
      : '¿Restaurar la lista por defecto? Tu lista personalizada se borrará.';
    if (!confirm(msg)) return;
    try { localStorage.removeItem(config.storageKey); } catch (_) {}
    await loadDefaults({ silent: false });
    dirty = false;
  });

  window.addEventListener('beforeunload', e => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
})();
