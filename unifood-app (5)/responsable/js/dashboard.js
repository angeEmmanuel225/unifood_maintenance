(function () {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) {
    window.location.href = 'index.html';
    return;
  }
  let auth;
  try {
    auth = JSON.parse(stored);
  } catch (e) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = 'index.html';
    return;
  }

  let departments = [];
  const $ = (id) => document.getElementById(id);

  // ---------- helpers ----------
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  const formatDateFR = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
  const formatDateTimeFR = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
  function stampClass(value) {
    if (['Résolue', 'Validée', 'Livrée', 'Normale', 'Traité', 'Vu'].includes(value)) return 'mint';
    if (['En cours', 'Nouveau', 'Urgente', 'Lu'].includes(value)) return 'amber';
    if (['Non résolue', 'Rejetée', 'Critique'].includes(value)) return 'raspberry';
    return 'steel';
  }
  function truncate(str, n) {
    if (!str) return '-';
    return str.length > n ? str.slice(0, n).trim() + '…' : str;
  }
  const HORAIRES = [
    ['06h-14h', '6h'],
    ['14h-22h', '14h'],
    ['22h-06h', '22h'],
    ['Journée 08h-16h', 'Jour'],
  ];
  function horaireLabel(h) {
    const f = HORAIRES.find((x) => x[0] === h);
    return f ? f[1] : h || '-';
  }

  async function authFetch(url, options = {}) {
    const headers = Object.assign({}, options.headers, { Authorization: `Bearer ${auth.token}` });
    const res = await fetch(`${API_BASE_URL}${url}`, Object.assign({}, options, { headers }));
    if (res.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.href = 'index.html';
      throw new Error('Session expirée');
    }
    return res;
  }
  async function downloadFile(url, filename) {
    try {
      const res = await authFetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'Téléchargement impossible.', 'error');
        return;
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      /* déjà géré */
    }
  }
  async function blobUrl(path) {
    const res = await authFetch(path);
    if (!res.ok) throw new Error('Fichier indisponible');
    return URL.createObjectURL(await res.blob());
  }
  async function viewFile(path) {
    const win = window.open('', '_blank');
    try {
      const url = await blobUrl(path);
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (e) {
      if (win) win.close();
      showToast("Impossible d'ouvrir le fichier (il a peut-être expiré).", 'error');
    }
  }
  function hydrateImages(container) {
    container.querySelectorAll('img[data-src]').forEach(async (img) => {
      try {
        const url = await blobUrl(img.dataset.src);
        img.src = url;
        img.addEventListener('click', () => window.open(url, '_blank'));
      } catch (e) {
        img.alt = 'Image indisponible';
      }
    });
  }
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icon(type === 'success' ? 'check' : 'alert', 16)} <span>${escapeHtml(message)}</span>`;
    $('toast-region').appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  }
  function openModal(html, wide = false) {
    const card = $('modal-card');
    card.classList.toggle('wide', wide);
    card.innerHTML = html;
    $('modal-overlay').classList.add('visible');
  }
  function closeModal() {
    $('modal-overlay').classList.remove('visible');
  }
  $('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  const exportBadge = (exporte) => (exporte ? `<span class="stamp mint">${icon('check', 12)} Oui</span>` : `<span class="stamp steel">Non</span>`);

  // ---------- icônes ----------
  $('logout-btn').innerHTML = icon('logout', 17);
  $('tab-rapports').innerHTML = icon('fileText', 15) + ' Rapports reçus';
  $('tab-commandes').innerHTML = icon('cart', 15) + ' Commandes reçues';
  $('tab-sorties').innerHTML = icon('package', 15) + ' Sorties magasin';
  $('tab-annonces').innerHTML = icon('bell', 15) + ' Annonces';
  $('tab-comptes').innerHTML = icon('users', 15) + ' Comptes';
  ['clock', 'flame', 'cart', 'alert', 'package'].forEach((n, i) => ($(`ic-stat-${i + 1}`).innerHTML = icon(n, 20)));
  $('btn-export-reports-pdf').innerHTML = icon('download', 15) + ' Exporter tout (PDF)';
  $('btn-delete-reports-bulk').innerHTML = icon('x', 15) + ' Supprimer la sélection';
  $('btn-export-orders-excel').innerHTML = icon('download', 15) + ' Exporter tout (Excel)';
  $('btn-delete-orders-bulk').innerHTML = icon('x', 15) + ' Supprimer la sélection';
  $('btn-seen-all').innerHTML = icon('check', 15) + ' Tout marquer comme vu';
  $('btn-export-sorties').innerHTML = icon('download', 15) + ' Exporter (Excel)';
  $('btn-delete-sorties-bulk').innerHTML = icon('x', 15) + ' Supprimer la sélection';
  $('an-pick-photo').innerHTML = icon('camera', 15) + ' Ajouter des photos';
  $('an-pick-pdf').innerHTML = icon('fileText', 15) + ' Ajouter un PDF';

  // ---------- utilisateur ----------
  function renderUser() {
    const u = auth.user;
    $('user-name').textContent = `${u.prenom === '-' ? '' : u.prenom} ${u.nom}`.trim();
    $('user-avatar').textContent = (((u.prenom && u.prenom !== '-' ? u.prenom[0] : '') + (u.nom ? u.nom[0] : '')).toUpperCase()) || 'A';
  }
  renderUser();
  $('logout-btn').addEventListener('click', () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = 'index.html';
  });

  // ---------- onglets ----------
  function activateTab(name) {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${name}`));
    if (name === 'rapports') loadReports();
    if (name === 'commandes') loadOrders();
    if (name === 'sorties') loadWithdrawals();
    if (name === 'annonces') loadAnnouncementsManageList();
    if (name === 'comptes' && window.UF.loadTechs) window.UF.loadTechs();
  }
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

  // ---------- départements ----------
  async function loadDepartments() {
    departments = await (await authFetch('/departments')).json();
    const options = departments.map((d) => `<option value="${escapeHtml(d.nom)}">${escapeHtml(d.nom)}</option>`).join('');
    ['fr-departement', 'fo-departement', 'fs-departement'].forEach((id) => ($(id).innerHTML = '<option value="">Tous</option>' + options));
  }

  // ---------- statistiques ----------
  async function loadStats() {
    try {
      const [rRes, oRes, wRes] = await Promise.all([authFetch('/reports/stats'), authFetch('/orders/stats'), authFetch('/withdrawals/stats')]);
      const r = await rRes.json();
      const o = await oRes.json();
      const w = await wRes.json();
      $('stat-today').textContent = r.rapportsAujourdhui ?? '0';
      $('stat-encours').textContent = r.pannesAujourdhui ?? '0';
      $('stat-attente').textContent = o.enAttente ?? '0';
      $('stat-urgentes').textContent = o.urgentes ?? '0';
      $('stat-sorties').textContent = w.nouvelles ?? '0';
      $('tab-sorties').innerHTML = icon('package', 15) + ' Sorties magasin' + (w.nouvelles ? `<span class="tab-badge">${w.nouvelles}</span>` : '');
    } catch (e) {
      /* hors connexion : anciens chiffres conservés */
    }
  }

  function paramsFrom(map, searchId) {
    const p = new URLSearchParams();
    Object.entries(map).forEach(([k, id]) => $(id).value && p.set(k, $(id).value));
    const q = $(searchId).value.trim();
    if (q) p.set('q', q);
    return p;
  }

  // ================= RAPPORTS =================
  const reportParams = () => paramsFrom({ departement: 'fr-departement', statutRapport: 'fr-statut-rapport', dateDebut: 'fr-date-debut', dateFin: 'fr-date-fin' }, 'fr-recherche');

  async function loadReports() {
    const tbody = $('reports-tbody');
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="spinner dark"></span></div></td></tr>`;
    const reports = await (await authFetch(`/reports?${reportParams().toString()}`)).json();
    if (!reports.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">${icon('fileText', 34)}<p>Aucun rapport pour ces filtres.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = reports
      .map((r) => {
        const machines = r.entries.map((e) => e.machineConcernee).join(', ');
        return `
      <tr>
        <td class="cell-mono">${formatDateFR(r.dateRapport)}</td>
        <td>${escapeHtml(r.technicienNom)}</td>
        <td>${escapeHtml(truncate(r.departement, 28))}</td>
        <td>${escapeHtml(horaireLabel(r.horaire))}</td>
        <td class="cell-muted">${r.entries.length ? `${r.entries.length} panne(s) — ${escapeHtml(truncate(machines, 30))}` : 'Rapport en photo'}${r.nbPhotos ? ` · ${icon('camera', 12)} ${r.nbPhotos}` : ''}</td>
        <td><select class="statut-rapport-select" data-id="${r._id}" style="padding:5px 8px; font-size:0.78rem;">${['Nouveau', 'Lu', 'Traité'].map((s) => `<option value="${s}" ${r.statutRapport === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td>${exportBadge(r.exporte)}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm view-report" data-id="${r._id}" title="Voir">${icon('eye', 15)}</button>
          <button class="btn btn-ghost btn-sm dl-report-pdf" data-id="${r._id}" title="PDF">${icon('download', 15)}</button>
          <button class="btn btn-ghost btn-sm del-report" data-id="${r._id}" title="Supprimer" style="color:var(--raspberry);">${icon('x', 15)}</button>
        </td>
      </tr>`;
      })
      .join('');
    tbody.querySelectorAll('.view-report').forEach((b) => b.addEventListener('click', () => showReportModal(b.dataset.id)));
    tbody.querySelectorAll('.dl-report-pdf').forEach((b) => b.addEventListener('click', () => downloadFile(`/reports/${b.dataset.id}/pdf`, `rapport-${b.dataset.id}.pdf`).then(loadReports)));
    tbody.querySelectorAll('.statut-rapport-select').forEach((sel) => sel.addEventListener('change', () => updateReportStatus(sel.dataset.id, sel.value)));
    tbody.querySelectorAll('.del-report').forEach((b) => b.addEventListener('click', () => deleteReport(b.dataset.id)));
  }

  async function updateReportStatus(id, statutRapport) {
    const res = await authFetch(`/reports/${id}/statut`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statutRapport }) });
    showToast(res.ok ? 'Statut du rapport mis à jour.' : 'Erreur lors de la mise à jour.', res.ok ? 'success' : 'error');
  }
  async function deleteReport(id) {
    if (!confirm('Supprimer définitivement cette fiche (et ses photos) ? Cette action est irréversible.')) return;
    const res = await authFetch(`/reports/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Fiche supprimée.');
      closeModal();
      loadReports();
      loadStats();
    } else showToast('Erreur lors de la suppression.', 'error');
  }

  async function showReportModal(id) {
    const res = await authFetch(`/reports/${id}`);
    if (!res.ok) {
      showToast('Rapport introuvable.', 'error');
      return;
    }
    const r = await res.json();
    const ticks =
      departments.map((d) => `<span class="tick"><i>${d.responsable === r.responsableDepartement ? '✓' : ''}</i> ${escapeHtml(d.responsable)}</span>`).join('') +
      '<span style="width:100%"></span>' +
      HORAIRES.map(([v, l]) => `<span class="tick"><i>${v === r.horaire ? '✓' : ''}</i> ${l}</span>`).join('');
    const rows = r.entries
      .map((e) => `<tr><td>${escapeHtml(e.machineConcernee)}</td><td>${escapeHtml(e.descriptionPanne)}</td><td>${escapeHtml(e.actionMenee)}</td><td>${escapeHtml(e.heureDebut)}</td><td>${escapeHtml(e.heureFin)}</td></tr>`)
      .join('') ||
      `<tr><td colspan="5" style="text-align:center; color:var(--gray);">${r.nbPhotos ? 'Rapport écrit envoyé en photo (voir ci-dessous).' : 'Aucune ligne.'}</td></tr>`;
    const photos = (r.photos || []).map((p) => `<img class="att-img" data-src="/reports/photo/${p._id}" alt="Photo du rapport">`).join('');
    openModal(
      `
      <button class="modal-close" id="modal-close">${icon('x', 16)}</button>
      <span class="stamp ${stampClass(r.statutRapport)}">${escapeHtml(r.statutRapport)}</span> ${exportBadge(r.exporte)}
      <h2 style="margin-top:14px;">Rapport journalier — ${formatDateFR(r.dateRapport)}</h2>
      <p style="color:var(--gray); font-size:0.85rem; margin-top:4px;">${escapeHtml(r.technicienNom)} · ${escapeHtml(r.departement)}</p>
      <div class="tick-list">${ticks}</div>
      <div class="table-wrap"><table class="modal-table">
        <thead><tr><th>Machine concernée</th><th>Panne ou observations</th><th>Tâche effectuée</th><th>Début</th><th>Fin</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${r.signature ? `<p class="cell-muted" style="margin-top:16px;">Signature du technicien</p><img class="modal-sig" src="${r.signature}" alt="Signature">` : ''}
      ${photos ? `<p class="cell-muted" style="margin-top:16px;">Photos du rapport papier (conservées 30 jours)</p><div class="att-grid" id="modal-photos">${photos}</div>` : ''}
      <div class="field" style="margin-top:16px; max-width:240px;">
        <label>Statut du rapport</label>
        <select id="modal-statut-rapport">${['Nouveau', 'Lu', 'Traité'].map((s) => `<option value="${s}" ${r.statutRapport === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
      <div class="form-actions" style="flex-wrap:wrap; margin-top:18px;">
        <button class="btn btn-outline" id="modal-delete" style="color:var(--raspberry); border-color:var(--raspberry);">${icon('x', 15)} Supprimer</button>
        <button class="btn btn-outline" id="modal-pdf">${icon('download', 15)} Télécharger le PDF</button>
        <button class="btn btn-primary" id="modal-save" style="width:auto;">${icon('check', 15)} Enregistrer</button>
      </div>`,
      true
    );
    $('modal-close').addEventListener('click', closeModal);
    $('modal-pdf').addEventListener('click', () => downloadFile(`/reports/${r._id}/pdf`, `rapport-${r._id}.pdf`).then(loadReports));
    $('modal-delete').addEventListener('click', () => deleteReport(r._id));
    $('modal-save').addEventListener('click', async () => {
      await updateReportStatus(r._id, $('modal-statut-rapport').value);
      closeModal();
      loadReports();
    });
    const pb = $('modal-photos');
    if (pb) hydrateImages(pb);
  }

  $('fr-btn-filtrer').addEventListener('click', loadReports);
  $('fr-btn-reset').addEventListener('click', () => {
    ['fr-departement', 'fr-statut-rapport', 'fr-date-debut', 'fr-date-fin', 'fr-recherche'].forEach((id) => ($(id).value = ''));
    loadReports();
  });
  $('btn-export-reports-pdf').addEventListener('click', () => downloadFile(`/reports/export/pdf?${reportParams().toString()}`, `rapports-unifood-${Date.now()}.pdf`).then(loadReports));
  $('btn-delete-reports-bulk').addEventListener('click', async () => {
    if (!$('fr-date-debut').value && !$('fr-date-fin').value) {
      showToast('Précise au moins une date (Du / Au) avant de supprimer en masse.', 'error');
      return;
    }
    if (!confirm('Supprimer TOUTES les fiches correspondant aux filtres actuels (photos comprises) ? Action irréversible.')) return;
    const res = await authFetch(`/reports/bulk?${reportParams().toString()}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    showToast(data.message || 'Terminé.', res.ok ? 'success' : 'error');
    loadReports();
    loadStats();
  });

  // ================= COMMANDES =================
  const orderParams = () => paramsFrom({ departement: 'fo-departement', statutCommande: 'fo-statut', urgence: 'fo-urgence', dateDebut: 'fo-date-debut', dateFin: 'fo-date-fin' }, 'fo-recherche');

  async function loadOrders() {
    const tbody = $('orders-tbody');
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="spinner dark"></span></div></td></tr>`;
    const orders = await (await authFetch(`/orders?${orderParams().toString()}`)).json();
    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">${icon('cart', 34)}<p>Aucune commande pour ces filtres.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = orders
      .map((o) => {
        const designations = o.items.map((it) => it.designation).join(', ');
        return `<tr>
        <td class="cell-mono">${formatDateFR(o.dateCommande)}</td>
        <td>${escapeHtml(o.technicienNom)}</td>
        <td>${escapeHtml(truncate(o.departement, 28))}</td>
        <td class="cell-muted">${o.items.length} article(s) — ${escapeHtml(truncate(designations, 32))}</td>
        <td>${exportBadge(o.exporte)}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm view-order" data-id="${o._id}" title="Voir">${icon('eye', 15)}</button>
          <button class="btn btn-ghost btn-sm dl-order-pdf" data-id="${o._id}" title="PDF">${icon('download', 15)}</button>
          <button class="btn btn-ghost btn-sm del-order" data-id="${o._id}" title="Supprimer" style="color:var(--raspberry);">${icon('x', 15)}</button>
        </td>
      </tr>`;
      })
      .join('');
    tbody.querySelectorAll('.view-order').forEach((b) => b.addEventListener('click', () => showOrderModal(orders.find((o) => o._id === b.dataset.id))));
    tbody.querySelectorAll('.dl-order-pdf').forEach((b) => b.addEventListener('click', () => downloadFile(`/orders/${b.dataset.id}/pdf`, `commande-${b.dataset.id}.pdf`).then(loadOrders)));
    tbody.querySelectorAll('.del-order').forEach((b) => b.addEventListener('click', () => deleteOrder(b.dataset.id)));
  }
  async function updateOrderItemStatus(orderId, itemId, body) {
    const res = await authFetch(`/orders/${orderId}/items/${itemId}/statut`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.ok;
  }
  async function deleteOrder(id) {
    if (!confirm('Supprimer définitivement cette fiche de commande ? Action irréversible.')) return;
    const res = await authFetch(`/orders/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Fiche supprimée.');
      closeModal();
      loadOrders();
      loadStats();
    } else showToast('Erreur lors de la suppression.', 'error');
  }
  function showOrderModal(o) {
    const itemsHtml = o.items
      .map(
        (it, i) => `
      <div class="order-item-block" data-item-id="${it._id}" style="border-top:1px solid var(--border); padding-top:14px; margin-top:14px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px;">
          <strong style="color:var(--praline); font-size:0.9rem;">Article ${i + 1} — ${escapeHtml(it.designation)}</strong>
          <span class="stamp ${stampClass(it.urgence)}">${escapeHtml(it.urgence)}</span>
        </div>
        <div class="detail-grid" style="margin-top:8px;">
          <div class="detail-item"><label>Quantité</label><p>${it.quantite} ${escapeHtml(it.unite)}</p></div>
          <div class="detail-item"><label>Référence</label><p>${escapeHtml(it.reference) || '-'}</p></div>
          <div class="detail-item"><label>Date souhaitée</label><p>${it.dateSouhaitee ? formatDateFR(it.dateSouhaitee) : 'Non précisée'}</p></div>
          <div class="detail-item"><label>Statut</label><select class="item-statut-select">${['En attente', 'Validée', 'Rejetée', 'Livrée'].map((s) => `<option value="${s}" ${it.statutCommande === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="detail-item full"><label>Motif / justification</label><p>${escapeHtml(it.motif)}</p></div>
          <div class="detail-item full"><label>Note pour le technicien <small class="hint">(optionnel)</small></label><textarea class="item-note-responsable" placeholder="Ajoute une note...">${escapeHtml(it.noteResponsable || '')}</textarea></div>
        </div>
      </div>`
      )
      .join('');
    openModal(`
      <button class="modal-close" id="modal-close">${icon('x', 16)}</button>
      ${exportBadge(o.exporte)}
      <h2 style="margin-top:14px;">Commande du ${formatDateFR(o.dateCommande)}</h2>
      <p style="color:var(--gray); font-size:0.85rem; margin-top:4px;">${escapeHtml(o.technicienNom)} · ${escapeHtml(o.departement)} · ${o.items.length} article(s)</p>
      ${itemsHtml}
      <div class="form-actions" style="flex-wrap:wrap; margin-top:18px;">
        <button class="btn btn-outline" id="modal-delete" style="color:var(--raspberry); border-color:var(--raspberry);">${icon('x', 15)} Supprimer</button>
        <button class="btn btn-outline" id="modal-pdf">${icon('download', 15)} PDF</button>
        <button class="btn btn-outline" id="modal-word">${icon('download', 15)} Word</button>
        <button class="btn btn-outline" id="modal-excel">${icon('download', 15)} Excel</button>
        <button class="btn btn-primary" id="modal-save" style="width:auto;">${icon('check', 15)} Enregistrer tout</button>
      </div>`);
    $('modal-close').addEventListener('click', closeModal);
    $('modal-pdf').addEventListener('click', () => downloadFile(`/orders/${o._id}/pdf`, `commande-${o._id}.pdf`));
    $('modal-word').addEventListener('click', () => downloadFile(`/orders/${o._id}/word`, `commande-${o._id}.docx`));
    $('modal-excel').addEventListener('click', () => downloadFile(`/orders/${o._id}/excel`, `commande-${o._id}.xlsx`));
    $('modal-delete').addEventListener('click', () => deleteOrder(o._id));
    $('modal-save').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      let ok = true;
      for (const block of document.querySelectorAll('.order-item-block')) {
        const done = await updateOrderItemStatus(o._id, block.dataset.itemId, {
          statutCommande: block.querySelector('.item-statut-select').value,
          noteResponsable: block.querySelector('.item-note-responsable').value,
        });
        if (!done) ok = false;
      }
      btn.disabled = false;
      showToast(ok ? 'Commande mise à jour.' : 'Certaines modifications ont échoué.', ok ? 'success' : 'error');
      closeModal();
      loadOrders();
      loadStats();
    });
  }
  $('fo-btn-filtrer').addEventListener('click', loadOrders);
  $('fo-btn-reset').addEventListener('click', () => {
    ['fo-departement', 'fo-statut', 'fo-urgence', 'fo-date-debut', 'fo-date-fin', 'fo-recherche'].forEach((id) => ($(id).value = ''));
    loadOrders();
  });
  $('btn-export-orders-excel').addEventListener('click', () => downloadFile(`/orders/export/excel?${orderParams().toString()}`, `commandes-unifood-${Date.now()}.xlsx`).then(loadOrders));
  $('btn-delete-orders-bulk').addEventListener('click', async () => {
    if (!$('fo-date-debut').value && !$('fo-date-fin').value) {
      showToast('Précise au moins une date (Du / Au) avant de supprimer en masse.', 'error');
      return;
    }
    if (!confirm('Supprimer TOUTES les commandes correspondant aux filtres actuels ? Action irréversible.')) return;
    const res = await authFetch(`/orders/bulk?${orderParams().toString()}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    showToast(data.message || 'Terminé.', res.ok ? 'success' : 'error');
    loadOrders();
    loadStats();
  });

  // ================= SORTIES MAGASIN =================
  const sortieParams = () => paramsFrom({ departement: 'fs-departement', statut: 'fs-statut', dateDebut: 'fs-date-debut', dateFin: 'fs-date-fin' }, 'fs-recherche');

  async function loadWithdrawals() {
    const tbody = $('sorties-tbody');
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="spinner dark"></span></div></td></tr>`;
    const list = await (await authFetch(`/withdrawals?${sortieParams().toString()}`)).json();
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">${icon('package', 34)}<p>Aucune sortie pour ces filtres.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = list
      .map((w) => {
        const pieces = w.items.map((i) => `${i.designation} ×${i.quantite}`).join(', ');
        const isNew = w.statut === 'Nouveau';
        return `
      <tr style="${isNew ? 'background:var(--amber-bg);' : ''}">
        <td class="cell-mono">${formatDateTimeFR(w.createdAt)}</td>
        <td><strong>${escapeHtml(w.technicienNom)}</strong></td>
        <td>${escapeHtml(truncate(w.departement, 28))}</td>
        <td class="cell-muted">${escapeHtml(truncate(pieces, 70))}</td>
        <td><span class="stamp ${isNew ? 'amber' : 'mint'}">${isNew ? 'À voir' : 'Vue'}</span></td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm view-sortie" data-id="${w._id}" title="Voir">${icon('eye', 15)}</button>
          ${isNew ? `<button class="btn btn-ghost btn-sm seen-sortie" data-id="${w._id}" title="Marquer comme vue">${icon('check', 15)}</button>` : ''}
          <button class="btn btn-ghost btn-sm del-sortie" data-id="${w._id}" title="Supprimer" style="color:var(--raspberry);">${icon('x', 15)}</button>
        </td>
      </tr>`;
      })
      .join('');
    tbody.querySelectorAll('.view-sortie').forEach((b) => b.addEventListener('click', () => showWithdrawalModal(list.find((w) => w._id === b.dataset.id))));
    tbody.querySelectorAll('.seen-sortie').forEach((b) => b.addEventListener('click', () => markSeen(b.dataset.id)));
    tbody.querySelectorAll('.del-sortie').forEach((b) => b.addEventListener('click', () => deleteWithdrawal(b.dataset.id)));
  }
  async function markSeen(id) {
    const res = await authFetch(`/withdrawals/${id}/vu`, { method: 'PATCH' });
    if (res.ok) {
      showToast('Marquée comme vue.');
      closeModal();
      loadWithdrawals();
      loadStats();
    }
  }
  async function deleteWithdrawal(id) {
    if (!confirm('Supprimer cette sortie magasin ?')) return;
    const res = await authFetch(`/withdrawals/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Sortie supprimée.');
      closeModal();
      loadWithdrawals();
      loadStats();
    }
  }
  function showWithdrawalModal(w) {
    const rows = w.items.map((i) => `<tr><td>${escapeHtml(i.designation)}</td><td>${escapeHtml(i.reference) || '-'}</td><td>${i.quantite} ${escapeHtml(i.unite)}</td><td>${escapeHtml(i.machine) || '-'}</td></tr>`).join('');
    openModal(
      `
      <button class="modal-close" id="modal-close">${icon('x', 16)}</button>
      <span class="stamp ${w.statut === 'Nouveau' ? 'amber' : 'mint'}">${w.statut === 'Nouveau' ? 'À voir' : 'Vue'}</span>
      <h2 style="margin-top:14px;">Sortie magasin — ${formatDateTimeFR(w.createdAt)}</h2>
      <p style="color:var(--gray); font-size:0.85rem; margin-top:4px;">${escapeHtml(w.technicienNom)} · ${escapeHtml(w.departement)}</p>
      <div class="table-wrap"><table class="modal-table"><thead><tr><th>Pièce</th><th>Référence</th><th>Quantité</th><th>Machine / destination</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${w.note ? `<div class="detail-item full" style="margin-top:14px;"><label>Note</label><p>${escapeHtml(w.note)}</p></div>` : ''}
      ${w.vuLe ? `<p class="cell-muted" style="margin-top:12px;">Vue par ${escapeHtml(w.vuPar)} le ${formatDateTimeFR(w.vuLe)}</p>` : ''}
      <div class="form-actions" style="margin-top:18px;">
        <button class="btn btn-outline" id="modal-delete" style="color:var(--raspberry); border-color:var(--raspberry);">${icon('x', 15)} Supprimer</button>
        ${w.statut === 'Nouveau' ? `<button class="btn btn-primary" id="modal-seen" style="width:auto;">${icon('check', 15)} Marquer comme vue</button>` : ''}
      </div>`,
      true
    );
    $('modal-close').addEventListener('click', closeModal);
    $('modal-delete').addEventListener('click', () => deleteWithdrawal(w._id));
    if ($('modal-seen')) $('modal-seen').addEventListener('click', () => markSeen(w._id));
  }
  $('fs-btn-filtrer').addEventListener('click', loadWithdrawals);
  $('fs-btn-reset').addEventListener('click', () => {
    ['fs-departement', 'fs-statut', 'fs-date-debut', 'fs-date-fin', 'fs-recherche'].forEach((id) => ($(id).value = ''));
    loadWithdrawals();
  });
  $('btn-seen-all').addEventListener('click', async () => {
    const res = await authFetch('/withdrawals/mark-all-seen', { method: 'POST' });
    if (res.ok) {
      showToast('Toutes les sorties sont marquées comme vues.');
      loadWithdrawals();
      loadStats();
    }
  });
  $('btn-export-sorties').addEventListener('click', () => downloadFile(`/withdrawals/export/excel?${sortieParams().toString()}`, `sorties-magasin-${Date.now()}.xlsx`));
  $('btn-delete-sorties-bulk').addEventListener('click', async () => {
    if (!$('fs-date-debut').value && !$('fs-date-fin').value) {
      showToast('Précise au moins une date (Du / Au) avant de supprimer en masse.', 'error');
      return;
    }
    if (!confirm('Supprimer TOUTES les sorties correspondant aux filtres actuels ? Action irréversible.')) return;
    const res = await authFetch(`/withdrawals/bulk?${sortieParams().toString()}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    showToast(data.message || 'Terminé.', res.ok ? 'success' : 'error');
    loadWithdrawals();
    loadStats();
  });

  // ================= ANNONCES =================
  function typeStampClass(type) {
    if (type === 'Annonce importante') return 'raspberry';
    if (type === 'Planning de la semaine') return 'mint';
    return 'amber';
  }
  // Planning publié jeudi, vendredi, samedi ou dimanche → vaut pour la semaine SUIVANTE (fin : vendredi de cette semaine-là).
  // Publié du lundi au mercredi → vaut pour la semaine en cours (fin : vendredi qui arrive).
  function defaultPlanningEnd() {
    const d = new Date();
    const day = d.getDay(); // 0 = dimanche
    const add = day >= 1 && day <= 3 ? 5 - day : ((8 - day) % 7 || 7) + 4;
    d.setDate(d.getDate() + add);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const anType = $('an-type');
  anType.addEventListener('change', () => {
    const planning = anType.value === 'Planning de la semaine';
    $('an-expire-field').style.display = planning ? 'flex' : 'none';
    $('an-expire').required = planning;
    if (planning && !$('an-expire').value) $('an-expire').value = defaultPlanningEnd();
  });

  let picked = []; // { file, name, size, preview }
  function renderPicked() {
    $('an-picked').innerHTML = picked
      .map((p, i) =>
        p.preview
          ? `<div class="att-item"><img class="att-img" src="${p.preview}" alt=""><button type="button" class="att-remove" data-i="${i}">${icon('x', 12)}</button></div>`
          : `<div class="att-item"><span class="att-chip">${icon('fileText', 15)} ${escapeHtml(truncate(p.name, 26))} · ${Math.round(p.size / 1024)} Ko</span><button type="button" class="att-remove" data-i="${i}">${icon('x', 12)}</button></div>`
      )
      .join('');
  }
  $('an-picked').addEventListener('click', (e) => {
    const b = e.target.closest('.att-remove');
    if (!b) return;
    picked.splice(Number(b.dataset.i), 1);
    renderPicked();
  });
  async function addPicked(files) {
    for (const f of files) {
      if (picked.length >= 6) {
        showToast('Maximum 6 fichiers par annonce.', 'error');
        break;
      }
      if (f.type.startsWith('image/')) {
        try {
          const { blob } = await ImageTools.compress(f, { maxDim: 1600, startQuality: 0.78, minQuality: 0.45, maxBytes: 380 * 1024 });
          const name = f.name.replace(/\.[^.]+$/, '') + '.jpg';
          picked.push({ file: new File([blob], name, { type: 'image/jpeg' }), name, size: blob.size, preview: URL.createObjectURL(blob) });
        } catch (err) {
          showToast("Impossible d'utiliser cette image.", 'error');
        }
      } else if (f.type === 'application/pdf') {
        if (f.size > 5 * 1024 * 1024) {
          showToast(`« ${f.name} » dépasse 5 Mo.`, 'error');
          continue;
        }
        picked.push({ file: f, name: f.name, size: f.size });
      }
    }
    renderPicked();
  }
  $('an-pick-photo').addEventListener('click', () => $('an-input-img').click());
  $('an-pick-pdf').addEventListener('click', () => $('an-input-pdf').click());
  [$('an-input-img'), $('an-input-pdf')].forEach((inp) =>
    inp.addEventListener('change', (e) => {
      addPicked([...e.target.files]);
      e.target.value = '';
    })
  );

  const announcementForm = $('announcement-form');
  announcementForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('announcement-submit');
    const fd = new FormData();
    fd.append('titre', $('an-titre').value);
    fd.append('type', anType.value);
    fd.append('contenu', $('an-contenu').value);
    if (anType.value === 'Planning de la semaine' && $('an-expire').value) fd.append('expireLe', $('an-expire').value);
    picked.forEach((p) => fd.append('fichiers', p.file, p.name));
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Publication...';
    try {
      const res = await authFetch('/announcements', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.message || 'Erreur lors de la publication.', 'error');
        return;
      }
      showToast('Annonce publiée — visible chez tous les techniciens.');
      announcementForm.reset();
      $('an-expire-field').style.display = 'none';
      picked = [];
      renderPicked();
      loadAnnouncementsManageList();
    } catch (err) {
      showToast('Pas de connexion : réessaie dans un instant.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Publier';
    }
  });

  function attachmentsManageHtml(a) {
    if (!a.fichiers || !a.fichiers.length) return '';
    return `<div class="att-grid">${a.fichiers
      .map((f) =>
        (f.contentType || '').startsWith('image/')
          ? `<div class="att-item"><img class="att-img" data-src="/announcements/files/${f._id}" alt=""><button type="button" class="att-remove" data-ann="${a._id}" data-file="${f._id}">${icon('x', 12)}</button></div>`
          : `<div class="att-item"><button type="button" class="att-chip" data-open="${f._id}">${icon('fileText', 15)} ${escapeHtml(truncate(f.nomFichier, 28))}</button><button type="button" class="att-remove" data-ann="${a._id}" data-file="${f._id}">${icon('x', 12)}</button></div>`
      )
      .join('')}</div>`;
  }

  async function loadAnnouncementsManageList() {
    const container = $('announcements-manage-list');
    container.innerHTML = `<div class="empty-state"><span class="spinner dark"></span></div>`;
    const list = await (await authFetch('/announcements')).json();
    if (!list.length) {
      container.innerHTML = `<div class="empty-state">${icon('bell', 34)}<p>Aucune annonce publiée pour l'instant.</p></div>`;
      return;
    }
    container.innerHTML = list
      .map(
        (a) => `
      <div class="announcement-card ${a.actif ? '' : 'inactive'}">
        <div class="ann-head"><h4>${escapeHtml(a.titre)}</h4><span class="stamp ${typeStampClass(a.type)}">${escapeHtml(a.type)}</span></div>
        <div class="ann-meta">${escapeHtml(a.auteur)} · ${formatDateFR(a.createdAt)} · ${a.actif ? 'Active' : 'Archivée'}${a.expireLe ? ` · Se supprime automatiquement après le ${formatDateFR(a.expireLe)}` : ''}</div>
        ${a.contenu ? `<div class="ann-content">${escapeHtml(a.contenu)}</div>` : ''}
        ${attachmentsManageHtml(a)}
        <div class="form-actions" style="margin-top:12px; justify-content:flex-start;">
          <button class="btn btn-outline btn-sm ann-toggle" data-id="${a._id}" data-actif="${a.actif}">${a.actif ? 'Archiver' : 'Réactiver'}</button>
          <button class="btn btn-outline btn-sm ann-delete" data-id="${a._id}" style="color:var(--raspberry); border-color:var(--raspberry);">${icon('x', 14)} Supprimer</button>
        </div>
      </div>`
      )
      .join('');
    hydrateImages(container);
    container.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => viewFile(`/announcements/files/${b.dataset.open}`)));
    container.querySelectorAll('.att-remove').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm("Retirer ce fichier de l'annonce ?")) return;
        const r = await authFetch(`/announcements/${b.dataset.ann}/files/${b.dataset.file}`, { method: 'DELETE' });
        if (r.ok) loadAnnouncementsManageList();
      })
    );
    container.querySelectorAll('.ann-toggle').forEach((b) =>
      b.addEventListener('click', async () => {
        const actif = b.dataset.actif === 'true';
        const r = await authFetch(`/announcements/${b.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actif: !actif }) });
        if (r.ok) {
          showToast(actif ? 'Annonce archivée.' : 'Annonce réactivée.');
          loadAnnouncementsManageList();
        }
      })
    );
    container.querySelectorAll('.ann-delete').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Supprimer définitivement cette annonce et ses fichiers ?')) return;
        const r = await authFetch(`/announcements/${b.dataset.id}`, { method: 'DELETE' });
        if (r.ok) {
          showToast('Annonce supprimée.');
          loadAnnouncementsManageList();
        }
      })
    );
  }

  // ---------- API partagée avec comptes.js ----------
  window.UF = {
    auth,
    authFetch,
    showToast,
    escapeHtml,
    icon,
    openModal,
    closeModal,
    getDepartments: () => departments,
    activateTab,
    _ready: false,
    _cbs: [],
    onReady(cb) {
      if (this._ready) cb();
      else this._cbs.push(cb);
    },
    _fire() {
      this._ready = true;
      this._cbs.forEach((f) => f());
    },
  };

  // ---------- démarrage ----------
  async function boot() {
    try {
      const meRes = await authFetch('/auth/me');
      if (!meRes.ok) throw new Error('unauthorized');
      auth.user = (await meRes.json()).user;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
      renderUser();
      await loadDepartments();
      await loadStats();
      await loadReports();
      $('page-loader').style.display = 'none';
      $('app').style.display = 'block';
      window.UF._fire();
      setInterval(loadStats, 60000); // les nouvelles sorties magasin apparaissent sans recharger la page
    } catch (err) {
      if (err && err.message === 'Session expirée') return;
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.href = 'index.html';
    }
  }
  boot();
})();
