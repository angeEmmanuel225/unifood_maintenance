// Sortie magasin : le technicien déclare les pièces qu'il prend au magasin → l'administrateur est prévenu.
(function () {
  if (!window.UF) return;
  window.UF.onReady(init);

  function init() {
    const { auth, authFetch, showToast, escapeHtml: esc, icon, formatDateTimeFR } = window.UF;
    const $ = (id) => document.getElementById(id);
    const draftKey = `unifood_store_draft_${auth.user.id}`;
    const rowsEl = $('store-rows');
    let sending = false;
    let restoring = true;
    let timer = null;

    $('store-add-row').innerHTML = icon('plus', 15) + ' Ajouter une pièce';

    function addRow(d = {}) {
      const units = ['pièce', 'kg', 'litre', 'mètre', 'sachet', 'boîte', 'autre'];
      const div = document.createElement('div');
      div.className = 'rows-row cols-store';
      div.innerHTML = `
        <div class="cell" data-label="Pièce (désignation)"><input type="text" class="s-designation" placeholder="Ex : Roulement 6205" value="${esc(d.designation || '')}"></div>
        <div class="cell" data-label="Référence"><input type="text" class="s-reference" placeholder="Optionnel" value="${esc(d.reference || '')}"></div>
        <div class="cell half" data-label="Quantité"><input type="number" class="s-quantite" min="1" step="1" inputmode="numeric" value="${esc(d.quantite || '')}" placeholder="1"></div>
        <div class="cell half" data-label="Unité"><select class="s-unite">${units.map((u) => `<option value="${u}" ${u === (d.unite || 'pièce') ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
        <div class="cell" data-label="Machine / destination"><input type="text" class="s-machine" placeholder="Ex : Four N°2" value="${esc(d.machine || '')}"></div>
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
        designation: r.querySelector('.s-designation').value.trim(),
        reference: r.querySelector('.s-reference').value.trim(),
        quantite: r.querySelector('.s-quantite').value,
        unite: r.querySelector('.s-unite').value,
        machine: r.querySelector('.s-machine').value.trim(),
      }));
    }
    const isBlank = (rows, note) => !note && !rows.some((r) => r.designation || r.reference || r.machine || r.quantite);

    // ---------- sauvegarde automatique (téléphone) ----------
    const hhmm = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    function setStatus(kind, text) {
      const el = $('store-autosave');
      el.className = `autosave-state ${kind}`;
      el.lastElementChild.textContent = text;
    }
    function saveNow() {
      const rows = collectRows();
      const note = $('store-note').value;
      if (isBlank(rows, note)) {
        localStorage.removeItem(draftKey);
        return;
      }
      const savedAt = Date.now();
      try {
        localStorage.setItem(draftKey, JSON.stringify({ rows, note, savedAt }));
        setStatus('saved', `Brouillon enregistré · ${hhmm(savedAt)}`);
      } catch (e) {
        /* mémoire pleine */
      }
    }
    function scheduleSave() {
      if (restoring) return;
      setStatus('saving', 'Enregistrement du brouillon…');
      clearTimeout(timer);
      timer = setTimeout(saveNow, 300);
    }
    const panel = $('panel-sortie-magasin');
    panel.addEventListener('input', scheduleSave);
    panel.addEventListener('change', scheduleSave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && !restoring && !sending) saveNow();
    });
    window.addEventListener('pagehide', () => {
      if (!restoring && !sending) saveNow();
    });

    $('store-add-row').addEventListener('click', () => {
      addRow().querySelector('.s-designation').focus();
      scheduleSave();
    });
    rowsEl.addEventListener('click', (e) => {
      const b = e.target.closest('.row-remove');
      if (!b) return;
      b.closest('.rows-row').remove();
      if (!rowsEl.children.length) addRow();
      scheduleSave();
    });

    // ---------- envoi ----------
    async function send() {
      if (sending) return;
      rowsEl.querySelectorAll('.invalid').forEach((r) => r.classList.remove('invalid'));
      const rows = collectRows();
      const rowEls = [...rowsEl.querySelectorAll('.rows-row')];
      const items = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.designation && !r.reference && !r.machine && !r.quantite) continue;
        if (!r.designation) {
          showToast(`Ligne ${i + 1} : indique la désignation de la pièce.`, 'error');
          rowEls[i].classList.add('invalid');
          return;
        }
        if (!(Number(r.quantite) >= 1)) {
          showToast(`Ligne ${i + 1} : indique la quantité (1 ou plus).`, 'error');
          rowEls[i].classList.add('invalid');
          return;
        }
        items.push({ ...r, quantite: Number(r.quantite) });
      }
      if (!items.length) {
        showToast('Ajoute au moins une pièce prise au magasin.', 'error');
        return;
      }
      const btn = $('store-send');
      sending = true;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Envoi...';
      try {
        const res = await authFetch('/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, note: $('store-note').value }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(data.message || "Erreur lors de l'envoi (ton brouillon est gardé).", 'error');
          return;
        }
        showToast("Sortie envoyée : l'administrateur est prévenu.");
        localStorage.removeItem(draftKey);
        resetRows([]);
        $('store-note').value = '';
        setStatus('saved', 'Sortie envoyée ✓');
        loadHistory();
      } catch (err) {
        showToast('Pas de connexion : ton brouillon est gardé sur ce téléphone.', 'error');
        setStatus('offline', 'Hors connexion : brouillon gardé');
      } finally {
        sending = false;
        btn.disabled = false;
        btn.innerHTML = "Envoyer à l'administrateur";
      }
    }
    $('store-send').addEventListener('click', send);

    // ---------- historique ----------
    async function loadHistory() {
      const tbody = $('store-history');
      try {
        const list = await (await authFetch('/withdrawals')).json();
        if (!list.length) {
          tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state">${icon('package', 34)}<p>Aucune sortie déclarée pour le moment.</p></div></td></tr>`;
          return;
        }
        tbody.innerHTML = list
          .slice(0, 30)
          .map((w) => {
            const pieces = w.items.map((i) => `${esc(i.designation)} ×${i.quantite}`).join(', ');
            const vu = w.statut === 'Vu';
            return `<tr><td class="cell-mono">${formatDateTimeFR(w.createdAt)}</td><td class="cell-muted">${pieces}</td><td><span class="stamp ${vu ? 'mint' : 'amber'}">${vu ? 'Vue ✓' : 'Envoyée'}</span></td></tr>`;
          })
          .join('');
      } catch (e) {
        /* hors connexion */
      }
    }
    window.UF.loadStoreHistory = loadHistory;

    // ---------- démarrage + restauration ----------
    resetRows([]);
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (draft && !isBlank(draft.rows || [], draft.note || '')) {
        resetRows(draft.rows);
        $('store-note').value = draft.note || '';
        showToast(`Brouillon « sortie magasin » retrouvé (${hhmm(draft.savedAt)}).`);
      }
    } catch (e) {
      /* brouillon illisible : ignoré */
    }
    restoring = false;
    loadHistory();
  }
})();
