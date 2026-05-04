/* ==========================================================================
   Impostor Musical — editor de canciones (acceso protegido)
   ========================================================================== */

(function () {
  'use strict';

  const PASSWORD = 'clarasobrado';
  const STORAGE_KEY = 'impostor.songs';
  const SESSION_KEY = 'impostor.editor.unlocked';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let songs = [];
  let dirty = false;
  let editingIndex = -1;

  // -------- Auth ----------------------------------------------------------
  const lockForm = $('#lock-form');
  const lockInput = $('#lock-input');
  const lockError = $('#lock-error');

  lockForm.addEventListener('submit', e => {
    e.preventDefault();
    if (lockInput.value === PASSWORD) {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) {}
      enterEditor();
    } else {
      lockError.hidden = false;
      lockInput.value = '';
      lockInput.focus();
    }
  });

  if (sessionStorage.getItem(SESSION_KEY) === '1') {
    enterEditor();
  } else {
    setTimeout(() => lockInput.focus(), 100);
  }

  function enterEditor() {
    $('#screen-lock').classList.remove('active');
    $('#screen-editor').classList.add('active');
    loadSongs();
    render();
  }

  // -------- Carga / persistencia -----------------------------------------
  function loadSongs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          songs = parsed.map(normalize);
          setStatus(`Lista personalizada (${songs.length})`, '');
          return;
        }
      }
    } catch (_) {}
    songs = SONGS.map(normalize);
    setStatus(`Lista por defecto (${songs.length})`, '');
  }

  function normalize(s) {
    return {
      title: String(s.title || '').trim(),
      artist: String(s.artist || '').trim(),
      emoji: String(s.emoji || '🎵').trim() || '🎵',
    };
  }

  function setStatus(text, kind) {
    const el = $('#editor-status');
    el.textContent = text;
    el.className = 'editor-status' + (kind ? ' ' + kind : '');
  }

  function markDirty() {
    dirty = true;
    setStatus(`Cambios sin guardar · ${songs.length} canciones`, 'dirty');
  }

  // -------- Render --------------------------------------------------------
  function render() {
    const list = $('#song-list');
    list.innerHTML = '';

    if (songs.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'song-empty';
      empty.textContent = 'No hay canciones. Añade alguna o restaura las de por defecto.';
      list.appendChild(empty);
      return;
    }

    songs.forEach((song, i) => {
      list.appendChild(renderItem(song, i));
    });
  }

  function renderItem(song, i) {
    const li = document.createElement('li');
    li.className = 'song-item';
    if (i === editingIndex) {
      li.classList.add('editing');
      li.appendChild(renderEditForm(song, i));
    } else {
      li.innerHTML = `
        <div class="emoji">${escapeHtml(song.emoji || '🎵')}</div>
        <div class="meta">
          <div class="title">${escapeHtml(song.title)}</div>
          <div class="artist">${escapeHtml(song.artist)}</div>
        </div>
        <div class="actions">
          <button class="icon-btn" type="button" data-action="edit" data-i="${i}" aria-label="Editar">✏️</button>
          <button class="icon-btn" type="button" data-action="delete" data-i="${i}" aria-label="Eliminar">🗑️</button>
        </div>
      `;
    }
    return li;
  }

  function renderEditForm(song, i) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="edit-row">
        <input data-edit="emoji" type="text" maxlength="4" value="${escapeAttr(song.emoji)}" />
        <input data-edit="title" type="text" maxlength="60" value="${escapeAttr(song.title)}" />
      </div>
      <div class="edit-row row-full">
        <input data-edit="artist" type="text" maxlength="60" value="${escapeAttr(song.artist)}" />
      </div>
      <div class="edit-actions">
        <button class="btn btn-ghost" type="button" data-action="cancel">Cancelar</button>
        <button class="btn btn-primary" type="button" data-action="confirm" data-i="${i}">Guardar</button>
      </div>
    `;
    return wrap;
  }

  // -------- Eventos delegados de la lista --------------------------------
  $('#song-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const i = parseInt(btn.dataset.i, 10);

    if (action === 'edit') {
      editingIndex = i;
      render();
    } else if (action === 'delete') {
      if (confirm(`¿Eliminar "${songs[i].title}"?`)) {
        songs.splice(i, 1);
        markDirty();
        render();
      }
    } else if (action === 'cancel') {
      editingIndex = -1;
      render();
    } else if (action === 'confirm') {
      const li = btn.closest('.song-item');
      const updated = {
        emoji: li.querySelector('[data-edit="emoji"]').value.trim() || '🎵',
        title: li.querySelector('[data-edit="title"]').value.trim(),
        artist: li.querySelector('[data-edit="artist"]').value.trim(),
      };
      if (!updated.title) {
        alert('El título no puede estar vacío.');
        return;
      }
      songs[i] = updated;
      editingIndex = -1;
      markDirty();
      render();
    }
  });

  // -------- Añadir nueva --------------------------------------------------
  $('#btn-add').addEventListener('click', () => {
    const emojiInput = $('#add-emoji');
    const titleInput = $('#add-title');
    const artistInput = $('#add-artist');
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      return;
    }
    songs.push({
      emoji: emojiInput.value.trim() || '🎵',
      title,
      artist: artistInput.value.trim(),
    });
    emojiInput.value = '';
    titleInput.value = '';
    artistInput.value = '';
    markDirty();
    render();
    // Hacemos scroll al nuevo elemento
    requestAnimationFrame(() => {
      const list = $('#song-list');
      list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  // -------- Guardar / restaurar ------------------------------------------
  $('#btn-save').addEventListener('click', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
      dirty = false;
      setStatus(`Guardado · ${songs.length} canciones`, 'saved');
    } catch (e) {
      alert('No se pudo guardar: ' + e.message);
    }
  });

  $('#btn-restore').addEventListener('click', () => {
    if (!confirm('Esto reemplaza tus canciones con la lista por defecto. ¿Continuar?')) return;
    songs = SONGS.map(normalize);
    editingIndex = -1;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    dirty = false;
    setStatus(`Lista por defecto restaurada (${songs.length})`, 'saved');
    render();
  });

  // -------- Exportar / importar (JSON) -----------------------------------
  $('#btn-export').addEventListener('click', () => {
    const data = JSON.stringify(songs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `impostor-canciones-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  $('#btn-import').addEventListener('click', () => {
    $('#file-import').click();
  });

  $('#file-import').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('JSON inválido');
      songs = parsed.map(normalize).filter(s => s.title);
      editingIndex = -1;
      markDirty();
      render();
    } catch (err) {
      alert('Archivo inválido: ' + err.message);
    } finally {
      e.target.value = '';
    }
  });

  // -------- Aviso al salir con cambios -----------------------------------
  window.addEventListener('beforeunload', e => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // -------- Helpers -------------------------------------------------------
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function escapeAttr(str) {
    return escapeHtml(str);
  }
})();
