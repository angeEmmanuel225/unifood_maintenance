// Fiche de rapport journalier : tableau à lignes, responsable/horaire à cocher, photo, signature,
// et SAUVEGARDE AUTOMATIQUE (téléphone + serveur) pour ne jamais perdre une fiche en cours de rédaction.
(function () {
  if (!window.UF) return;
  window.UF.onReady(init);

  function init() {
    const { auth, authFetch, showToast, escapeHtml: esc, icon } = window.UF;
    const $ = (id) => document.getElementById(id);
    const user = auth.user;
    const depts = window.UF.getDepartments();
    const draftKey = `unifood_fiche_draft_${user.id}`;
    const MAX_PHOTOS = 3;

    const panel = $('panel-nouveau-rapport');
    const rowsEl = $('fiche-rows');
    let photos = []; // { dataUrl, size }
    let sigHasInk = false;
    let sending = false;
    let restoring = true;

    $('fiche-tech').textContent = `${user.prenom === '-' ? '' : user.prenom} ${user.nom}`.trim();
    $('fiche-dept').textContent = user.departement || '—';
    $('fiche-add-row').innerHTML = icon('plus', 15) + ' Ajouter une panne';
    $('photo-cam').innerHTML = icon('camera', 15) + ' Prendre une photo';
    $('photo-gal').innerHTML = icon('image', 15) + ' Choisir une image';

    // ---------- logo (remplaçable : technicien/assets/logo-unifood.png) ----------
    (function renderLogo() {
      const box = $('fiche-logo');
      const img = new Image();
      img.alt = 'UNIFOOD';
      img.onload = () => {
        box.innerHTML = '';
        box.appendChild(img);
      };
      img.onerror = () => {
        box.innerHTML =
          '<div class="logo-fallback"><img src="assets/icon-192.png" width="52" height="52" style="border-radius:12px" alt="">' +
          '<div><strong>UNIFOOD</strong><span>Togo · Confiserie</span></div></div>';
      };
      img.src = 'assets/logo-unifood.png';
    })();

    // ---------- responsables de département (cases à cocher) ----------
    const shortDept = (nom) => (nom.length > 30 ? nom.slice(0, 29) + '…' : nom);
    $('fiche-resp-list').innerHTML = depts
      .map((d) => `<label class="check"><input type="checkbox" name="resp" value="${esc(d.responsable)}"><b>${esc(d.responsable)}</b><small>${esc(shortDept(d.nom))}</small></label>`)
      .join('');

    function checkedValue(name) {
      const el = panel.querySelector(`input[name="${name}"]:checked`);
      return el ? el.value : '';
    }
    function setChecked(name, value) {
      panel.querySelectorAll(`input[name="${name}"]`).forEach((i) => (i.checked = !!value && i.value === value));
    }
    // une seule case cochée par groupe
    panel.addEventListener('change', (e) => {
      const t = e.target;
      if (t.matches('input[type="checkbox"][name]') && t.checked) {
        panel.querySelectorAll(`input[name="${t.name}"]`).forEach((i) => {
          if (i !== t) i.checked = false;
        });
      }
    });

    // ---------- lignes du tableau ----------
    function addRow(data = {}) {
      const div = document.createElement('div');
      div.className = 'rows-row cols-fiche';
      div.innerHTML = `
        <div class="cell" data-label="Machine concernée"><input type="text" class="f-machine" placeholder="Ex : Four tunnel N°2" value="${esc(data.machineConcernee || '')}"></div>
        <div class="cell" data-label="Panne ou observations"><textarea class="f-panne" rows="2" placeholder="Décris la panne ou ton observation">${esc(data.descriptionPanne || '')}</textarea></div>
        <div class="cell" data-label="Tâche effectuée"><textarea class="f-tache" rows="2" placeholder="Ce que tu as fait">${esc(data.actionMenee || '')}</textarea></div>
        <div class="cell half" data-label="Début"><input type="time" class="f-debut" value="${esc(data.heureDebut || '')}"></div>
        <div class="cell half" data-label="Fin"><input type="time" class="f-fin" value="${esc(data.heureFin || '')}"></div>
        <div class="cell act"><button type="button" class="row-remove" title="Supprimer cette ligne">${icon('x', 16)}</button></div>`;
      rowsEl.appendChild(div);
      return div;
    }
    function resetRows(list) {
      rowsEl.innerHTML = '';
      (list && list.length ? list : [{}]).forEach(addRow);
    }
    function collectRows() {
      return [...rowsEl.querySelectorAll('.rows-row')].map((r) => ({
        machineConcernee: r.querySelector('.f-machine').value.trim(),
        descriptionPanne: r.querySelector('.f-panne').value.trim(),
        actionMenee: r.querySelector('.f-tache').value.trim(),
        heureDebut: r.querySelector('.f-debut').value,
        heureFin: r.querySelector('.f-fin').value,
      }));
    }
    $('fiche-add-row').addEventListener('click', () => {
      addRow().querySelector('.f-machine').focus();
      scheduleSave();
    });
    rowsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.row-remove');
      if (!btn) return;
      btn.closest('.rows-row').remove();
      if (!rowsEl.children.length) addRow();
      scheduleSave();
    });

    // ---------- signature ----------
    const sig = $('sig-canvas');
    const sctx = sig.getContext('2d');
    sctx.lineWidth = 3.6;
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    sctx.strokeStyle = '#1a1a1a';
    let drawing = false;
    function sigPos(e) {
      const r = sig.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * sig.width) / r.width, y: ((e.clientY - r.top) * sig.height) / r.height };
    }
    sig.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      drawing = true;
      try {
        sig.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignoré */
      }
      const p = sigPos(e);
      sctx.beginPath();
      sctx.moveTo(p.x, p.y);
      sctx.lineTo(p.x + 0.1, p.y + 0.1);
      sctx.stroke();
      sigHasInk = true;
    });
    sig.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = sigPos(e);
      sctx.lineTo(p.x, p.y);
      sctx.stroke();
      sctx.beginPath();
      sctx.moveTo(p.x, p.y);
    });
    const endSig = () => {
      if (!drawing) return;
      drawing = false;
      scheduleSave();
    };
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => sig.addEventListener(ev, endSig));
    function clearSignature() {
      sctx.clearRect(0, 0, sig.width, sig.height);
      sigHasInk = false;
    }
    $('sig-clear').addEventListener('click', () => {
      clearSignature();
      scheduleSave();
    });
    function loadSignature(dataUrl) {
      const img = new Image();
      img.onload = () => {
        sctx.clearRect(0, 0, sig.width, sig.height);
        sctx.drawImage(img, 0, 0, sig.width, sig.height);
        sigHasInk = true;
      };
      img.src = dataUrl;
    }

    // ---------- photos du rapport papier ----------
    function renderPhotos() {
      $('photo-thumbs').innerHTML = photos
        .map((p, i) => `<div class="photo-thumb"><img src="${p.dataUrl}" alt="Photo ${i + 1}"><button type="button" data-i="${i}" title="Retirer">${icon('x', 13)}</button><small>${Math.round(p.size / 1024)} Ko</small></div>`)
        .join('');
    }
    $('photo-thumbs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      photos.splice(Number(b.dataset.i), 1);
      renderPhotos();
      scheduleSave();
    });
    async function addFiles(files) {
      for (const file of files) {
        if (photos.length >= MAX_PHOTOS) {
          showToast(`Maximum ${MAX_PHOTOS} photos par envoi.`, 'error');
          break;
        }
        if (!file.type.startsWith('image/')) continue;
        try {
          showToast('Compression de la photo…');
          const { blob } = await ImageTools.compress(file, { grayscale: true, maxDim: 1400, maxBytes: 130 * 1024 });
          if (!blob || blob.size > 420 * 1024) throw new Error('trop lourde');
          photos.push({ dataUrl: await ImageTools.blobToDataURL(blob), size: blob.size });
        } catch (err) {
          showToast("Impossible d'utiliser cette image.", 'error');
        }
      }
      renderPhotos();
      scheduleSave();
    }
    $('photo-cam').addEventListener('click', () => $('photo-input-cam').click());
    $('photo-gal').addEventListener('click', () => $('photo-input-gal').click());
    ['photo-input-cam', 'photo-input-gal'].forEach((id) =>
      $(id).addEventListener('change', (e) => {
        addFiles([...e.target.files]);
        e.target.value = '';
      })
    );

    // ---------- état + sauvegarde automatique ----------
    function today() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function getState() {
      return { date: $('fiche-date').value, horaire: checkedValue('horaire'), resp: checkedValue('resp'), rows: collectRows(), savedAt: Date.now() };
    }
    function isBlank(st) {
      return !st || !st.rows || !st.rows.some((r) => r.machineConcernee || r.descriptionPanne || r.actionMenee || r.heureDebut || r.heureFin);
    }
    function applyState(st) {
      if (st.date) $('fiche-date').value = st.date;
      setChecked('horaire', st.horaire);
      if (st.resp) setChecked('resp', st.resp);
      resetRows(st.rows);
    }
    const hhmm = (ts) => new Date(ts || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    function setStatus(kind, text) {
      const el = $('autosave-state');
      el.className = `autosave-state ${kind}`;
      el.lastElementChild.textContent = text;
    }

    // 1) sur le téléphone (immédiat, même sans réseau) : lignes + cases + photos + signature
    function saveLocal() {
      const st = getState();
      const full = { ...st, photos, signature: sigHasInk ? sig.toDataURL('image/png') : '' };
      try {
        localStorage.setItem(draftKey, JSON.stringify(full));
      } catch (e) {
        try {
          localStorage.setItem(draftKey, JSON.stringify({ ...st, photos: [], signature: full.signature }));
        } catch (e2) {
          /* mémoire pleine : la sauvegarde serveur prend le relais */
        }
      }
      return st;
    }

    // 2) sur le serveur (quelques secondes après) : lignes + cases, récupérables même si le téléphone est vidé
    let localTimer = null;
    let remoteTimer = null;
    async function pushRemote() {
      const st = getState();
      if (isBlank(st) || sending) return;
      try {
        const res = await authFetch('/reports/draft/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: st }) });
        if (res.ok) setStatus('saved', `Brouillon enregistré · ${hhmm(st.savedAt)} (aussi sur le serveur)`);
      } catch (e) {
        setStatus('offline', 'Hors connexion : brouillon gardé sur ce téléphone');
      }
    }
    function scheduleSave() {
      if (restoring) return;
      setStatus('saving', 'Enregistrement du brouillon…');
      clearTimeout(localTimer);
      localTimer = setTimeout(() => {
        const st = saveLocal();
        setStatus('saved', `Brouillon enregistré · ${hhmm(st.savedAt)}`);
      }, 350);
      clearTimeout(remoteTimer);
      remoteTimer = setTimeout(pushRemote, 3000);
    }
    panel.addEventListener('input', scheduleSave);
    panel.addEventListener('change', (e) => {
      if (e.target.type !== 'file') scheduleSave();
    });

    // Sauvegarde immédiate quand on quitte l'application, que l'écran s'éteint ou qu'on change d'application
    function flush() {
      if (restoring || sending) return;
      const st = saveLocal();
      if (!isBlank(st)) {
        fetch(`${API_BASE_URL}/reports/draft/me`, {
          method: 'PUT',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
          body: JSON.stringify({ data: st }),
        }).catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', () => {
      if (!restoring && !sending) saveLocal();
    });

    // ---------- restauration du brouillon (le plus récent des deux) ----------
    async function restore() {
      let local = null;
      try {
        local = JSON.parse(localStorage.getItem(draftKey) || 'null');
      } catch (e) {
        local = null;
      }
      let remote = null;
      try {
        const r = await authFetch('/reports/draft/me');
        if (r.ok) remote = (await r.json()).data;
      } catch (e) {
        remote = null;
      }
      const lt = local && !isBlank(local) ? local.savedAt || 0 : -1;
      const rt = remote && !isBlank(remote) ? remote.savedAt || 0 : -1;
      if (lt < 0 && rt < 0) return false;
      const chosen = lt >= rt ? local : remote;
      applyState(chosen);
      if (local && local.photos && local.photos.length) {
        photos = local.photos;
        renderPhotos();
      }
      if (local && local.signature) loadSignature(local.signature);
      showToast(`Brouillon retrouvé — dernière sauvegarde à ${hhmm(chosen.savedAt)}. Tu peux continuer.`);
      return true;
    }

    // ---------- envoi ----------
    function fail(message, row) {
      showToast(message, 'error');
      if (row) {
        row.classList.add('invalid');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    async function send() {
      if (sending) return;
      rowsEl.querySelectorAll('.invalid').forEach((r) => r.classList.remove('invalid'));
      const st = getState();
      if (!st.resp) return fail('Coche le responsable de département (en haut de la fiche).');
      if (!st.horaire) return fail('Coche ton horaire de travail : 6h, 14h, 22h ou Jour.');
      if (!st.date) return fail('Indique la date.');

      const entries = [];
      const rowEls = [...rowsEl.querySelectorAll('.rows-row')];
      const rows = collectRows();
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.machineConcernee && !r.descriptionPanne && !r.actionMenee) continue;
        if (!r.machineConcernee || !r.descriptionPanne) return fail(`Ligne ${i + 1} : indique la machine et la panne (ou l'observation).`, rowEls[i]);
        entries.push(r);
      }
      if (!entries.length) return fail('Ajoute au moins une panne dans le tableau.');
      if (!sigHasInk) return fail("Signe la fiche avant de l'envoyer (cadre en bas).");

      const payload = {
        dateRapport: st.date,
        horaire: st.horaire,
        departement: user.departement || (depts.find((d) => d.responsable === st.resp) || {}).nom || '',
        responsableDepartement: st.resp,
        entries,
        signature: sig.toDataURL('image/png'),
        photos: photos.map((p) => p.dataUrl),
      };

      const btn = $('fiche-send');
      sending = true;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Envoi...';
      try {
        const res = await authFetch('/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(data.message || "Erreur lors de l'envoi (ta fiche est gardée en brouillon).", 'error');
          return;
        }
        showToast(`Fiche envoyée à l'administrateur (${data.lignes} ligne(s) au total aujourd'hui).`);
        localStorage.removeItem(draftKey);
        clearTimeout(localTimer);
        clearTimeout(remoteTimer);
        photos = [];
        renderPhotos();
        clearSignature();
        resetRows([]);
        setStatus('saved', 'Fiche envoyée ✓');
        window.UF.refreshAfterSend();
      } catch (err) {
        showToast('Pas de connexion : ta fiche est gardée sur ce téléphone, réessaie plus tard.', 'error');
        setStatus('offline', 'Hors connexion : brouillon gardé sur ce téléphone');
      } finally {
        sending = false;
        btn.disabled = false;
        btn.innerHTML = 'Envoyer le rapport';
      }
    }
    $('fiche-send').addEventListener('click', send);

    // ---------- démarrage ----------
    $('fiche-date').value = today();
    const mine = depts.find((d) => d.nom === user.departement);
    if (mine) setChecked('resp', mine.responsable);
    resetRows([]);
    restore().finally(() => {
      restoring = false;
      setStatus('saved', 'Brouillon enregistré automatiquement');
    });
  }
})();
