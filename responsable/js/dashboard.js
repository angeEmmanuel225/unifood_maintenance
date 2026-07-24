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

  // ---------- helpers ----------
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDateFR(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function stampClass(value) {
    if (['Résolue', 'Validée', 'Livrée', 'Normale', 'Traité'].includes(value)) return 'mint';
    if (['En cours', 'Nouveau', 'Urgente', 'Lu'].includes(value)) return 'amber';
    if (['Non résolue', 'Rejetée', 'Critique'].includes(value)) return 'raspberry';
    return 'steel';
  }

  function truncate(str, n) {
    if (!str) return '-';
    return str.length > n ? str.slice(0, n).trim() + '…' : str;
  }

  async function authFetch(url, options = {}) {
    const headers = Object.assign({}, options.headers, {
      Authorization: `Bearer ${auth.token}`,
    });
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
      /* déjà géré par authFetch en cas de 401 */
    }
  }

  function showToast(message, type = 'success') {
    const region = document.getElementById('toast-region');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icon(type === 'success' ? 'check' : 'alert', 16)} <span>${escapeHtml(message)}</span>`;
    region.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  }

  function openModal(html) {
    document.getElementById('modal-card').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('visible');
  }
  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('visible');
  }
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  function exportBadge(exporte) {
    return exporte
      ? `<span class="stamp mint">${icon('check', 12)} Oui</span>`
      : `<span class="stamp steel">Non</span>`;
  }

  // ---------- static icons ----------
  document.getElementById('logout-btn').innerHTML = icon('logout', 17);
  document.getElementById('tab-rapports').innerHTML = icon('fileText', 15) + ' Rapports reçus';
  document.getElementById('tab-commandes').innerHTML = icon('cart', 15) + ' Commandes reçues';
  document.getElementById('ic-stat-1').innerHTML = icon('clock', 20);
  document.getElementById('ic-stat-2').innerHTML = icon('flame', 20);
  document.getElementById('ic-stat-3').innerHTML = icon('cart', 20);
  document.getElementById('ic-stat-4').innerHTML = icon('alert', 20);
  document.getElementById('btn-export-reports-pdf').innerHTML = icon('download', 15) + ' Exporter tout (PDF)';
  document.getElementById('btn-export-orders-excel').innerHTML = icon('download', 15) + ' Exporter tout (Excel)';
  document.getElementById('btn-delete-reports-bulk').innerHTML = icon('x', 15) + ' Supprimer la sélection';
  document.getElementById('btn-delete-orders-bulk').innerHTML = icon('x', 15) + ' Supprimer la sélection';

  // ---------- user info ----------
  document.getElementById('user-name').textContent = `${auth.user.prenom} ${auth.user.nom}`;
  document.getElementById('user-avatar').textContent = `${(auth.user.prenom || ' ')[0]}${(auth.user.nom || ' ')[0]}`.toUpperCase();

  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = 'index.html';
  });

  // ---------- tabs ----------
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'rapports') loadReports();
      if (btn.dataset.tab === 'commandes') loadOrders();
    });
  });

  // ---------- departments (for filters) ----------
  async function loadDepartments() {
    const res = await authFetch('/departments');
    departments = await res.json();
    const options = departments.map((d) => `<option value="${escapeHtml(d.nom)}">${escapeHtml(d.nom)}</option>`).join('');
    document.getElementById('fr-departement').innerHTML = '<option value="">Tous</option>' + options;
    document.getElementById('fo-departement').innerHTML = '<option value="">Tous</option>' + options;
  }

  // ---------- stats ----------
  async function loadStats() {
    const [rRes, oRes] = await Promise.all([authFetch('/reports/stats'), authFetch('/orders/stats')]);
    const rStats = await rRes.json();
    const oStats = await oRes.json();
    document.getElementById('stat-today').textContent = rStats.rapportsAujourdhui ?? '0';
    document.getElementById('stat-encours').textContent = rStats.pannesEnCours ?? '0';
    document.getElementById('stat-attente').textContent = oStats.enAttente ?? '0';
    document.getElementById('stat-urgentes').textContent = oStats.urgentes ?? '0';
  }

  // ================= RAPPORTS =================
  function reportFilterParams() {
    const params = new URLSearchParams();
    const departement = document.getElementById('fr-departement').value;
    const statutPanne = document.getElementById('fr-statut-panne').value;
    const statutRapport = document.getElementById('fr-statut-rapport').value;
    const dateDebut = document.getElementById('fr-date-debut').value;
    const dateFin = document.getElementById('fr-date-fin').value;
    const q = document.getElementById('fr-recherche').value.trim();
    if (departement) params.set('departement', departement);
    if (statutPanne) params.set('statutPanne', statutPanne);
    if (statutRapport) params.set('statutRapport', statutRapport);
    if (dateDebut) params.set('dateDebut', dateDebut);
    if (dateFin) params.set('dateFin', dateFin);
    if (q) params.set('q', q);
    return params;
  }

  async function loadReports() {
    const tbody = document.getElementById('reports-tbody');
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="spinner dark"></span></div></td></tr>`;

    const res = await authFetch(`/reports?${reportFilterParams().toString()}`);
    const reports = await res.json();

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
        <td>${escapeHtml(r.departement)}</td>
        <td>${escapeHtml(r.horaire)}</td>
        <td class="cell-muted">${r.entries.length} panne(s) — ${escapeHtml(truncate(machines, 32))}</td>
        <td>
          <select class="statut-rapport-select" data-id="${r._id}" style="padding:5px 8px; font-size:0.78rem;">
            <option value="Nouveau" ${r.statutRapport === 'Nouveau' ? 'selected' : ''}>Nouveau</option>
            <option value="Lu" ${r.statutRapport === 'Lu' ? 'selected' : ''}>Lu</option>
            <option value="Traité" ${r.statutRapport === 'Traité' ? 'selected' : ''}>Traité</option>
          </select>
        </td>
        <td>${exportBadge(r.exporte)}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm view-report" data-id="${r._id}" title="Voir">${icon('eye', 15)}</button>
          <button class="btn btn-ghost btn-sm dl-report-pdf" data-id="${r._id}" title="PDF">${icon('download', 15)}</button>
          <button class="btn btn-ghost btn-sm del-report" data-id="${r._id}" title="Supprimer" style="color:var(--raspberry);">${icon('x', 15)}</button>
        </td>
      </tr>`;
      })
      .join('');

    tbody.querySelectorAll('.view-report').forEach((b) =>
      b.addEventListener('click', () => showReportModal(reports.find((r) => r._id === b.dataset.id)))
    );
    tbody.querySelectorAll('.dl-report-pdf').forEach((b) =>
      b.addEventListener('click', () => downloadFile(`/reports/${b.dataset.id}/pdf`, `rapport-${b.dataset.id}.pdf`).then(loadReports))
    );
    tbody.querySelectorAll('.statut-rapport-select').forEach((sel) =>
      sel.addEventListener('change', async () => {
        await updateReportStatus(sel.dataset.id, { statutRapport: sel.value });
      })
    );
    tbody.querySelectorAll('.del-report').forEach((b) =>
      b.addEventListener('click', () => deleteReport(b.dataset.id))
    );
  }

  async function updateReportStatus(id, body) {
    const res = await authFetch(`/reports/${id}/statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      showToast('Statut du rapport mis à jour.');
      loadStats();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.message || 'Erreur lors de la mise à jour.', 'error');
    }
  }

  async function deleteReport(id) {
    if (!confirm('Supprimer définitivement cette fiche de rapport ? Cette action est irréversible.')) return;
    const res = await authFetch(`/reports/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Fiche supprimée.');
      closeModal();
      loadReports();
      loadStats();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.message || 'Erreur lors de la suppression.', 'error');
    }
  }

  function showReportModal(r) {
    const entriesHtml = r.entries
      .map(
        (e, i) => `
      <div style="border-top:1px solid var(--border); padding-top:14px; margin-top:14px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px;">
          <strong style="color:var(--praline); font-size:0.9rem;">Panne ${i + 1} — ${escapeHtml(e.machineConcernee)}</strong>
          <span class="stamp ${stampClass(e.statutPanne)}">${escapeHtml(e.statutPanne)}</span>
        </div>
        <p class="cell-muted" style="margin-top:4px;">Heure de début : ${escapeHtml(e.heureDebut)} — Heure de fin : ${escapeHtml(e.heureFin)}</p>
        <div class="detail-grid" style="margin-top:8px;">
          <div class="detail-item full"><label>Description de la panne</label><p>${escapeHtml(e.descriptionPanne)}</p></div>
          <div class="detail-item full"><label>Action menée</label><p>${escapeHtml(e.actionMenee)}</p></div>
          ${e.observations ? `<div class="detail-item full"><label>Observations</label><p>${escapeHtml(e.observations)}</p></div>` : ''}
        </div>
      </div>`
      )
      .join('');

    openModal(`
      <button class="modal-close" id="modal-close">${icon('x', 16)}</button>
      <span class="stamp ${stampClass(r.statutRapport)}">${escapeHtml(r.statutRapport)}</span>
      ${exportBadge(r.exporte)}
      <h2 style="margin-top:14px;">Fiche du ${formatDateFR(r.dateRapport)}</h2>
      <p style="color:var(--gray); font-size:0.85rem; margin-top:4px;">${escapeHtml(r.technicienNom)} · ${escapeHtml(r.departement)} · ${escapeHtml(r.horaire)} · ${r.entries.length} panne(s)</p>
      <div class="detail-grid" style="margin-top:14px;">
        <div class="detail-item"><label>Responsable de département</label><p>${escapeHtml(r.responsableDepartement)}</p></div>
        <div class="detail-item full">
          <label>Statut du rapport</label>
          <select id="modal-statut-rapport">
            <option value="Nouveau" ${r.statutRapport === 'Nouveau' ? 'selected' : ''}>Nouveau</option>
            <option value="Lu" ${r.statutRapport === 'Lu' ? 'selected' : ''}>Lu</option>
            <option value="Traité" ${r.statutRapport === 'Traité' ? 'selected' : ''}>Traité</option>
          </select>
        </div>
      </div>
      ${entriesHtml}
      <div class="form-actions" style="flex-wrap:wrap; margin-top:18px;">
        <button class="btn btn-outline" id="modal-delete" style="color:var(--raspberry); border-color:var(--raspberry);">${icon('x', 15)} Supprimer</button>
        <button class="btn btn-outline" id="modal-pdf">${icon('download', 15)} Télécharger le PDF</button>
        <button class="btn btn-primary" id="modal-save" style="width:auto;">${icon('check', 15)} Enregistrer</button>
      </div>
    `);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-pdf').addEventListener('click', () => downloadFile(`/reports/${r._id}/pdf`, `rapport-${r._id}.pdf`));
    document.getElementById('modal-delete').addEventListener('click', () => deleteReport(r._id));
    document.getElementById('modal-save').addEventListener('click', async () => {
      const statutRapport = document.getElementById('modal-statut-rapport').value;
      await updateReportStatus(r._id, { statutRapport });
      closeModal();
      loadReports();
    });
  }

  document.getElementById('fr-btn-filtrer').addEventListener('click', loadReports);
  document.getElementById('fr-btn-reset').addEventListener('click', () => {
    document.getElementById('fr-departement').value = '';
    document.getElementById('fr-statut-panne').value = '';
    document.getElementById('fr-statut-rapport').value = '';
    document.getElementById('fr-date-debut').value = '';
    document.getElementById('fr-date-fin').value = '';
    document.getElementById('fr-recherche').value = '';
    loadReports();
  });
  document.getElementById('btn-export-reports-pdf').addEventListener('click', () =>
    downloadFile(`/reports/export/pdf?${reportFilterParams().toString()}`, `rapports-unifood-${Date.now()}.pdf`).then(loadReports)
  );
  document.getElementById('btn-delete-reports-bulk').addEventListener('click', async () => {
    const dateDebut = document.getElementById('fr-date-debut').value;
    const dateFin = document.getElementById('fr-date-fin').value;
    if (!dateDebut && !dateFin) {
      showToast('Précise au moins une date (Du / Au) avant de supprimer en masse.', 'error');
      return;
    }
    if (!confirm('Supprimer TOUTES les fiches correspondant aux filtres actuels ? Cette action est irréversible.')) return;
    const res = await authFetch(`/reports/bulk?${reportFilterParams().toString()}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast(data.message || 'Suppression groupée effectuée.');
      loadReports();
      loadStats();
    } else {
      showToast(data.message || 'Erreur lors de la suppression groupée.', 'error');
    }
  });

  // ================= COMMANDES =================
  function orderFilterParams() {
    const params = new URLSearchParams();
    const departement = document.getElementById('fo-departement').value;
    const statutCommande = document.getElementById('fo-statut').value;
    const urgence = document.getElementById('fo-urgence').value;
    const dateDebut = document.getElementById('fo-date-debut').value;
    const dateFin = document.getElementById('fo-date-fin').value;
    const q = document.getElementById('fo-recherche').value.trim();
    if (departement) params.set('departement', departement);
    if (statutCommande) params.set('statutCommande', statutCommande);
    if (urgence) params.set('urgence', urgence);
    if (dateDebut) params.set('dateDebut', dateDebut);
    if (dateFin) params.set('dateFin', dateFin);
    if (q) params.set('q', q);
    return params;
  }

  async function loadOrders() {
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="spinner dark"></span></div></td></tr>`;

    const res = await authFetch(`/orders?${orderFilterParams().toString()}`);
    const orders = await res.json();

    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">${icon('cart', 34)}<p>Aucune commande pour ces filtres.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = orders
      .map((o) => {
        const designations = o.items.map((it) => it.designation).join(', ');
        return `
      <tr>
        <td class="cell-mono">${formatDateFR(o.dateCommande)}</td>
        <td>${escapeHtml(o.technicienNom)}</td>
        <td>${escapeHtml(o.departement)}</td>
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

    tbody.querySelectorAll('.view-order').forEach((b) =>
      b.addEventListener('click', () => showOrderModal(orders.find((o) => o._id === b.dataset.id)))
    );
    tbody.querySelectorAll('.dl-order-pdf').forEach((b) =>
      b.addEventListener('click', () => downloadFile(`/orders/${b.dataset.id}/pdf`, `commande-${b.dataset.id}.pdf`).then(loadOrders))
    );
    tbody.querySelectorAll('.del-order').forEach((b) =>
      b.addEventListener('click', () => deleteOrder(b.dataset.id))
    );
  }

  async function updateOrderItemStatus(orderId, itemId, body) {
    const res = await authFetch(`/orders/${orderId}/items/${itemId}/statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.message || 'Erreur lors de la mise à jour.', 'error');
      return false;
    }
    return true;
  }

  async function deleteOrder(id) {
    if (!confirm('Supprimer définitivement cette fiche de commande ? Cette action est irréversible.')) return;
    const res = await authFetch(`/orders/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Fiche supprimée.');
      closeModal();
      loadOrders();
      loadStats();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.message || 'Erreur lors de la suppression.', 'error');
    }
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
          <div class="detail-item">
            <label>Statut</label>
            <select class="item-statut-select">
              <option value="En attente" ${it.statutCommande === 'En attente' ? 'selected' : ''}>En attente</option>
              <option value="Validée" ${it.statutCommande === 'Validée' ? 'selected' : ''}>Validée</option>
              <option value="Rejetée" ${it.statutCommande === 'Rejetée' ? 'selected' : ''}>Rejetée</option>
              <option value="Livrée" ${it.statutCommande === 'Livrée' ? 'selected' : ''}>Livrée</option>
            </select>
          </div>
          <div class="detail-item full"><label>Motif / justification</label><p>${escapeHtml(it.motif)}</p></div>
          <div class="detail-item full">
            <label>Note du responsable <small class="hint">(optionnel)</small></label>
            <textarea class="item-note-responsable" placeholder="Ajoutez une note pour le technicien...">${escapeHtml(it.noteResponsable || '')}</textarea>
          </div>
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
      </div>
    `);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-pdf').addEventListener('click', () => downloadFile(`/orders/${o._id}/pdf`, `commande-${o._id}.pdf`));
    document.getElementById('modal-word').addEventListener('click', () => downloadFile(`/orders/${o._id}/word`, `commande-${o._id}.docx`));
    document.getElementById('modal-excel').addEventListener('click', () => downloadFile(`/orders/${o._id}/excel`, `commande-${o._id}.xlsx`));
    document.getElementById('modal-delete').addEventListener('click', () => deleteOrder(o._id));
    document.getElementById('modal-save').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const blocks = document.querySelectorAll('.order-item-block');
      let allOk = true;
      for (const block of blocks) {
        const itemId = block.dataset.itemId;
        const statutCommande = block.querySelector('.item-statut-select').value;
        const noteResponsable = block.querySelector('.item-note-responsable').value;
        const ok = await updateOrderItemStatus(o._id, itemId, { statutCommande, noteResponsable });
        if (!ok) allOk = false;
      }
      btn.disabled = false;
      if (allOk) {
        showToast('Commande mise à jour.');
        loadStats();
      }
      closeModal();
      loadOrders();
    });
  }

  document.getElementById('fo-btn-filtrer').addEventListener('click', loadOrders);
  document.getElementById('fo-btn-reset').addEventListener('click', () => {
    document.getElementById('fo-departement').value = '';
    document.getElementById('fo-statut').value = '';
    document.getElementById('fo-urgence').value = '';
    document.getElementById('fo-date-debut').value = '';
    document.getElementById('fo-date-fin').value = '';
    document.getElementById('fo-recherche').value = '';
    loadOrders();
  });
  document.getElementById('btn-export-orders-excel').addEventListener('click', () =>
    downloadFile(`/orders/export/excel?${orderFilterParams().toString()}`, `commandes-unifood-${Date.now()}.xlsx`).then(loadOrders)
  );
  document.getElementById('btn-delete-orders-bulk').addEventListener('click', async () => {
    const dateDebut = document.getElementById('fo-date-debut').value;
    const dateFin = document.getElementById('fo-date-fin').value;
    if (!dateDebut && !dateFin) {
      showToast('Précise au moins une date (Du / Au) avant de supprimer en masse.', 'error');
      return;
    }
    if (!confirm('Supprimer TOUTES les commandes correspondant aux filtres actuels ? Cette action est irréversible.')) return;
    const res = await authFetch(`/orders/bulk?${orderFilterParams().toString()}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast(data.message || 'Suppression groupée effectuée.');
      loadOrders();
      loadStats();
    } else {
      showToast(data.message || 'Erreur lors de la suppression groupée.', 'error');
    }
  });

  // ---------- boot ----------
  async function boot() {
    try {
      const meRes = await authFetch('/auth/me');
      if (!meRes.ok) throw new Error('unauthorized');
      const me = await meRes.json();
      auth.user = me.user;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));

      await loadDepartments();
      await loadStats();
      await loadReports();

      document.getElementById('page-loader').style.display = 'none';
      document.getElementById('app').style.display = 'block';
    } catch (err) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.href = 'index.html';
    }
  }

  boot();
})();
