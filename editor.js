/* ==========================================================================
   Impostor Musical — editor de canciones (sin contraseña, formato texto)
   ========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'impostor.songsText';

  const $ = (sel) => document.querySelector(sel);
  const textarea = $('#songs-text');
  const status = $('#editor-status');

  let dirty = false;
  let usingDefaults = true;

  // -------- Inicialización -----------------------------------------------
  init();

  async function init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored != null) {
      textarea.value = stored;
      usingDefaults = false;
      setStatus(`Lista personalizada · ${countSongs(stored)} canciones`, '');
    } else {
      await loadDefaults({ silent: true });
    }
  }

  async function loadDefaults({ silent = false } = {}) {
    try {
      const res = await fetch('songs.txt', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      textarea.value = text.replace(/\s+$/, '') + '\n';
      usingDefaults = true;
      if (!silent) {
        setStatus(`Lista por defecto restaurada · ${countSongs(text)} canciones`, 'saved');
      } else {
        setStatus(`Lista por defecto · ${countSongs(text)} canciones`, '');
      }
    } catch (e) {
      setStatus('No se pudo cargar la lista por defecto: ' + e.message, 'dirty');
    }
  }

  // -------- Helpers -------------------------------------------------------
  function countSongs(text) {
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
    setStatus(`Cambios sin guardar · ${countSongs(textarea.value)} canciones`, 'dirty');
  }

  // -------- Eventos -------------------------------------------------------
  textarea.addEventListener('input', markDirty);

  $('#btn-save').addEventListener('click', () => {
    const text = textarea.value;
    if (countSongs(text) === 0) {
      if (!confirm('La lista está vacía. ¿Seguro que quieres guardar?')) return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, text);
      dirty = false;
      usingDefaults = false;
      setStatus(`Guardado · ${countSongs(text)} canciones`, 'saved');
    } catch (e) {
      alert('No se pudo guardar: ' + e.message);
    }
  });

  $('#btn-restore').addEventListener('click', async () => {
    const msg = dirty
      ? 'Tienes cambios sin guardar y vas a perderlos. ¿Restaurar la lista por defecto?'
      : '¿Restaurar la lista por defecto? Tu lista personalizada se borrará.';
    if (!confirm(msg)) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
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
