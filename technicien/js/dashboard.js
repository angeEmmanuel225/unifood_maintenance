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
    if (['Résolue', 'Validée', 'Livrée', 'Normale'].includes(value)) return 'mint';
    if (['En cours', 'Nouveau', 'Urgente'].includes(value)) return 'amber';
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

  // ---------- static icons ----------
  document.getElementById('logout-btn').innerHTML = icon('logout', 17);
  document.getElementById('tab-nouveau-rapport').innerHTML = icon('plus', 15) + ' Nouveau rapport';
  document.getElementById('tab-nouvelle-commande').innerHTML = icon('package', 15) + ' Nouvelle commande';
  document.getElementById('tab-mes-rapports').innerHTML = icon('fileText', 15) + ' Mes rapports';
  document.getElementById('tab-mes-commandes').innerHTML = icon('cart', 15) + ' Mes commandes';
  document.getElementById('tab-annonces').innerHTML = icon('bell', 15) + ' Annonces';
  document.getElementById('ic-stat-1').innerHTML = icon('clock', 20);
  document.getElementById('ic-stat-2').innerHTML = icon('flame', 20);
  document.getElementById('ic-stat-3').innerHTML = icon('cart', 20);

  // ---------- user info ----------
  document.getElementById('user-name').textContent = `${auth.user.prenom} ${auth.user.nom}`;
  document.getElementById('user-dept').textContent = auth.user.departement || 'Technicien';
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
      if (btn.dataset.tab === 'mes-rapports') loadReports();
      if (btn.dataset.tab === 'mes-commandes') loadOrders();
      if (btn.dataset.tab === 'annonces') loadAnnouncementsList();
    });
  });

  // ---------- departments ----------
  async function loadDepartments() {
    const res = await authFetch('/departments');
    departments = await res.json();

    const selects = [document.getElementById('r-departement'), document.getElementById('o-departement')];
    selects.forEach((sel) => {
      sel.innerHTML = departments.map((d) => `<option value="${escapeHtml(d.nom)}">${escapeHtml(d.nom)}</option>`).join('');
      const match = departments.find((d) => d.nom === auth.user.departement);
      if (match) sel.value = match.nom;
    });

    const match = departments.find((d) => d.nom === auth.user.departement);
    document.getElementById('r-responsable').value = match ? match.responsable : '';
  }

  document.getElementById('r-departement').addEventListener('change', (e) => {
    const match = departments.find((d) => d.nom === e.target.value);
    document.getElementById('r-responsable').value = match ? match.responsable : '';
  });

  // ---------- stats ----------
  async function loadStats() {
    const [rRes, oRes] = await Promise.all([authFetch('/reports/stats'), authFetch('/orders/stats')]);
    const rStats = await rRes.json();
    const oStats = await oRes.json();
    document.getElementById('stat-today').textContent = rStats.rapportsAujourdhui ?? '0';
    document.getElementById('stat-encours').textContent = rStats.pannesEnCours ?? '0';
    document.getElementById('stat-attente').textContent = oStats.enAttente ?? '0';
  }

  // ---------- annonces ----------
  const DISMISSED_KEY = 'unifood_technicien_dismissed_announcement';

  function typeStampClass(type) {
    if (type === 'Annonce importante') return 'raspberry';
    if (type === 'Planning de la semaine') return 'mint';
    return 'amber';
  }

  async function loadAnnouncementBanner() {
    const res = await authFetch('/announcements');
    const list = await res.json();
    const banner = document.getElementById('announcement-banner');
    if (!list.length) {
      banner.style.display = 'none';
      return;
    }
    const latest = list[0];
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed === latest._id) {
      banner.style.display = 'none';
      return;
    }
    banner.innerHTML = `
      <div class="ann-icon">${icon(latest.type === 'Planning de la semaine' ? 'calendar' : 'megaphone', 18)}</div>
      <div class="ann-body">
        <div class="ann-eyebrow">${escapeHtml(latest.type)} · ${escapeHtml(latest.auteur)}</div>
        <h4>${escapeHtml(latest.titre)}</h4>
        <p>${escapeHtml(truncate(latest.contenu, 160))}</p>
      </div>
      <button class="ann-close" id="ann-banner-close" title="Fermer">${icon('x', 16)}</button>
    `;
    banner.style.display = 'flex';
    document.getElementById('ann-banner-close').addEventListener('click', () => {
      localStorage.setItem(DISMISSED_KEY, latest._id);
      banner.style.display = 'none';
    });
  }

  async function loadAnnouncementsList() {
    const container = document.getElementById('announcements-list');
    container.innerHTML = `<div class="empty-state"><span class="spinner dark"></span></div>`;
    const res = await authFetch('/announcements');
    const list = await res.json();

    if (!list.length) {
      container.innerHTML = `<div class="empty-state">${icon('bell', 34)}<p>Aucune annonce pour le moment.</p></div>`;
      return;
    }

    container.innerHTML = list
      .map(
        (a) => `
      <div class="announcement-card">
        <div class="ann-head">
          <h4>${escapeHtml(a.titre)}</h4>
          <span class="stamp ${typeStampClass(a.type)}">${escapeHtml(a.type)}</span>
        </div>
        <div class="ann-meta">Publié par ${escapeHtml(a.auteur)} · ${formatDateFR(a.createdAt)}${a.expireLe ? ` · Valable jusqu'au ${formatDateFR(a.expireLe)}` : ''}</div>
        <div class="ann-content">${escapeHtml(a.contenu)}</div>
      </div>`
      )
      .join('');
  }

  // ---------- report form ----------
  const reportForm = document.getElementById('report-form');
  document.getElementById('r-date').value = new Date().toISOString().slice(0, 10);

  reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('report-submit');
    const payload = {
      dateRapport: document.getElementById('r-date').value,
      horaire: document.getElementById('r-horaire').value,
      departement: document.getElementById('r-departement').value,
      responsableDepartement: document.getElementById('r-responsable').value,
      machineConcernee: document.getElementById('r-machine').value,
      statutPanne: document.getElementById('r-statut').value,
      heureDebut: document.getElementById('r-heure-debut').value,
      heureFin: document.getElementById('r-heure-fin').value,
      descriptionPanne: document.getElementById('r-panne').value,
      actionMenee: document.getElementById('r-action').value,
      observations: document.getElementById('r-observations').value,
    };

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Enregistrement...';
    try {
      const res = await authFetch('/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || "Erreur lors de l'enregistrement.", 'error');
        return;
      }
      showToast('Panne ajoutée à la fiche du jour.');
      reportForm.reset();
      document.getElementById('r-date').value = new Date().toISOString().slice(0, 10);
      const match = departments.find((d) => d.nom === auth.user.departement);
      if (match) {
        document.getElementById('r-departement').value = match.nom;
        document.getElementById('r-responsable').value = match.responsable;
      }
      loadStats();
      loadReports();
    } catch (err) {
      /* géré */
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Enregistrer le rapport';
    }
  });

  // ---------- order form ----------
  const orderForm = document.getElementById('order-form');

  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('order-submit');
    const payload = {
      departement: document.getElementById('o-departement').value,
      designation: document.getElementById('o-designation').value,
      reference: document.getElementById('o-reference').value,
      quantite: Number(document.getElementById('o-quantite').value),
      unite: document.getElementById('o-unite').value,
      urgence: document.getElementById('o-urgence').value,
      dateSouhaitee: document.getElementById('o-date-souhaitee').value || undefined,
      motif: document.getElementById('o-motif').value,
    };

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Envoi...';
    try {
      const res = await authFetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || "Erreur lors de l'envoi.", 'error');
        return;
      }
      showToast('Article ajouté à la commande du jour.');
      orderForm.reset();
      const match = departments.find((d) => d.nom === auth.user.departement);
      if (match) document.getElementById('o-departement').value = match.nom;
      loadStats();
      loadOrders();
    } catch (err) {
      /* géré */
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Envoyer la commande';
    }
  });

  // ---------- reports table ----------
  async function loadReports() {
    const tbody = document.getElementById('reports-tbody');
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="spinner dark"></span></div></td></tr>`;

    const params = new URLSearchParams();
    const statutPanne = document.getElementById('fr-statut-panne').value;
    const dateDebut = document.getElementById('fr-date-debut').value;
    const dateFin = document.getElementById('fr-date-fin').value;
    if (statutPanne) params.set('statutPanne', statutPanne);
    if (dateDebut) params.set('dateDebut', dateDebut);
    if (dateFin) params.set('dateFin', dateFin);

    const res = await authFetch(`/reports?${params.toString()}`);
    const reports = await res.json();

    if (!reports.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">${icon('fileText', 34)}<p>Aucun rapport pour ces filtres.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = reports
      .map((r) => {
        const machines = r.entries.map((e) => e.machineConcernee).join(', ');
        return `
      <tr>
        <td class="cell-mono">${formatDateFR(r.dateRapport)}</td>
        <td>${escapeHtml(r.horaire)}</td>
        <td class="cell-muted">${r.entries.length} panne(s) — ${escapeHtml(truncate(machines, 40))}</td>
        <td><span class="stamp ${stampClass(r.statutRapport)}">${escapeHtml(r.statutRapport)}</span></td>
        <td><button class="btn btn-ghost btn-sm view-report" data-id="${r._id}">${icon('eye', 15)}</button></td>
      </tr>`;
      })
      .join('');

    tbody.querySelectorAll('.view-report').forEach((b) =>
      b.addEventListener('click', () => showReportModal(reports.find((r) => r._id === b.dataset.id)))
    );
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
      <h2 style="margin-top:14px;">Fiche du ${formatDateFR(r.dateRapport)}</h2>
      <p style="color:var(--gray); font-size:0.85rem; margin-top:4px;">${escapeHtml(r.horaire)} · ${escapeHtml(r.departement)} · ${r.entries.length} panne(s) déclarée(s)</p>
      ${entriesHtml}
      <div class="form-actions" style="margin-top:18px;">
        <button class="btn btn-outline" id="modal-pdf">${icon('download', 15)} Télécharger le PDF</button>
      </div>
    `);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-pdf').addEventListener('click', () => downloadFile(`/reports/${r._id}/pdf`, `rapport-${r._id}.pdf`));
  }

  document.getElementById('fr-btn-filtrer').addEventListener('click', loadReports);
  document.getElementById('fr-btn-reset').addEventListener('click', () => {
    document.getElementById('fr-statut-panne').value = '';
    document.getElementById('fr-date-debut').value = '';
    document.getElementById('fr-date-fin').value = '';
    loadReports();
  });

  // ---------- orders table ----------
  async function loadOrders() {
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><span class="spinner dark"></span></div></td></tr>`;

    const params = new URLSearchParams();
    const statutCommande = document.getElementById('fo-statut').value;
    const urgence = document.getElementById('fo-urgence').value;
    if (statutCommande) params.set('statutCommande', statutCommande);
    if (urgence) params.set('urgence', urgence);

    const res = await authFetch(`/orders?${params.toString()}`);
    const orders = await res.json();

    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state">${icon('cart', 34)}<p>Aucune commande pour ces filtres.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = orders
      .map((o) => {
        const designations = o.items.map((it) => it.designation).join(', ');
        return `
      <tr>
        <td class="cell-mono">${formatDateFR(o.dateCommande)}</td>
        <td class="cell-muted">${o.items.length} article(s) — ${escapeHtml(truncate(designations, 40))}</td>
        <td><button class="btn btn-ghost btn-sm view-order" data-id="${o._id}">${icon('eye', 15)}</button></td>
      </tr>`;
      })
      .join('');

    tbody.querySelectorAll('.view-order').forEach((b) =>
      b.addEventListener('click', () => showOrderModal(orders.find((o) => o._id === b.dataset.id)))
    );
  }

  function showOrderModal(o) {
    const itemsHtml = o.items
      .map(
        (it, i) => `
      <div style="border-top:1px solid var(--border); padding-top:14px; margin-top:14px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px;">
          <strong style="color:var(--praline); font-size:0.9rem;">Article ${i + 1} — ${escapeHtml(it.designation)}</strong>
          <span class="stamp ${stampClass(it.urgence)}">${escapeHtml(it.urgence)}</span>
        </div>
        <div class="detail-grid" style="margin-top:8px;">
          <div class="detail-item"><label>Quantité</label><p>${it.quantite} ${escapeHtml(it.unite)}</p></div>
          <div class="detail-item"><label>Référence</label><p>${escapeHtml(it.reference) || '-'}</p></div>
          <div class="detail-item"><label>Date souhaitée</label><p>${it.dateSouhaitee ? formatDateFR(it.dateSouhaitee) : 'Non précisée'}</p></div>
          <div class="detail-item"><label>Statut</label><p><span class="stamp ${stampClass(it.statutCommande)}">${escapeHtml(it.statutCommande)}</span></p></div>
          <div class="detail-item full"><label>Motif / justification</label><p>${escapeHtml(it.motif)}</p></div>
          ${it.noteResponsable ? `<div class="detail-item full"><label>Note du responsable</label><p>${escapeHtml(it.noteResponsable)}</p></div>` : ''}
        </div>
      </div>`
      )
      .join('');

    openModal(`
      <button class="modal-close" id="modal-close">${icon('x', 16)}</button>
      <h2 style="margin-top:14px;">Commande du ${formatDateFR(o.dateCommande)}</h2>
      <p style="color:var(--gray); font-size:0.85rem; margin-top:4px;">${escapeHtml(o.departement)} · ${o.items.length} article(s)</p>
      ${itemsHtml}
      <div class="form-actions" style="margin-top:18px;">
        <button class="btn btn-outline" id="modal-pdf">${icon('download', 15)} PDF</button>
      </div>
    `);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-pdf').addEventListener('click', () => downloadFile(`/orders/${o._id}/pdf`, `commande-${o._id}.pdf`));
  }

  document.getElementById('fo-btn-filtrer').addEventListener('click', loadOrders);
  document.getElementById('fo-btn-reset').addEventListener('click', () => {
    document.getElementById('fo-statut').value = '';
    document.getElementById('fo-urgence').value = '';
    loadOrders();
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
      await loadAnnouncementBanner();

      document.getElementById('page-loader').style.display = 'none';
      document.getElementById('app').style.display = 'block';
    } catch (err) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.href = 'index.html';
    }
  }

  boot();
})();
