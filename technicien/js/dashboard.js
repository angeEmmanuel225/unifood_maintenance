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
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function formatDateFR(d) {
    return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  }
  function formatDateTimeFR(d) {
    return d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
  }
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
  const HORAIRE_LABELS = { '06h-14h': '6h – 14h', '14h-22h': '14h – 22h', '22h-06h': '22h – 6h', 'Journée 08h-16h': 'Jour (8h – 16h)' };
  function horaireLabel(h) {
    return HORAIRE_LABELS[h] || h || '-';
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
      /* déjà géré par authFetch */
    }
  }

  async function blobUrl(path) {
    const res = await authFetch(path);
    if (!res.ok) throw new Error('Fichier indisponible');
    return URL.createObjectURL(await res.blob());
  }
  async function viewFile(path) {
    // fenêtre ouverte tout de suite (sinon les téléphones bloquent l'ouverture après le chargement)
    const win = window.open('', '_blank');
    try {
      const url = await blobUrl(path);
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (err) {
      if (win) win.close();
      showToast("Impossible d'ouvrir le fichier (il a peut-être expiré).", 'error');
    }
  }
  // Charge les <img data-src="/chemin-api"> avec l'authentification
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
    const region = document.getElementById('toast-region');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icon(type === 'success' ? 'check' : 'alert', 16)} <span>${escapeHtml(message)}</span>`;
    region.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  }
  function openModal(html, wide = false) {
    const card = document.getElementById('modal-card');
    card.classList.toggle('wide', wide);
    card.innerHTML = html;
    document.getElementById('modal-overlay').classList.add('visible');
  }
  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('visible');
  }
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  // ---------- icônes ----------
  document.getElementById('logout-btn').innerHTML = icon('logout', 17);
  document.getElementById('tab-annonces').innerHTML = icon('bell', 15) + ' Annonces';
  document.getElementById('tab-nouveau-rapport').innerHTML = icon('plus', 15) + ' Nouveau rapport';
  document.getElementById('tab-sortie-magasin').innerHTML = icon('package', 15) + ' Sortie magasin';
  document.getElementById('tab-nouvelle-commande').innerHTML = icon('cart', 15) + ' Nouvelle commande';
  document.getElementById('tab-mes-rapports').innerHTML = icon('fileText', 15) + ' Mes rapports';
  document.getElementById('tab-mes-commandes').innerHTML = icon('list', 15) + ' Mes commandes';
  document.getElementById('ic-stat-1').innerHTML = icon('clock', 20);
  document.getElementById('ic-stat-2').innerHTML = icon('flame', 20);
  document.getElementById('ic-stat-3').innerHTML = icon('cart', 20);

  // ---------- utilisateur ----------
  function renderUser() {
    const u = auth.user;
    document.getElementById('user-name').textContent = `${u.prenom === '-' ? '' : u.prenom} ${u.nom}`.trim();
    document.getElementById('user-dept').textContent = u.departement || 'Technicien';
    document.getElementById('user-avatar').textContent = ((u.prenom && u.prenom !== '-' ? u.prenom[0] : '') + (u.nom ? u.nom[0] : '')).toUpperCase() || 'T';
  }
  renderUser();
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = 'index.html';
  });

  // ---------- onglets ----------
  function activateTab(name) {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${name}`));
    if (name === 'mes-rapports') loadReports();
    if (name === 'mes-commandes') loadOrders();
    if (name === 'annonces') loadAnnouncementsList();
    if (name === 'sortie-magasin' && window.UF.loadStoreHistory) window.UF.loadStoreHistory();
  }
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

  // ---------- départements ----------
  async function loadDepartments() {
    const res = await authFetch('/departments');
    departments = await res.json();
    const sel = document.getElementById('o-departement');
    sel.innerHTML = departments.map((d) => `<option value="${escapeHtml(d.nom)}">${escapeHtml(d.nom)}</option>`).join('');
    const match = departments.find((d) => d.nom === auth.user.departement);
    if (match) sel.value = match.nom;
  }

  // ---------- statistiques ----------
  async function loadStats() {
    try {
      const [rRes, oRes] = await Promise.all([authFetch('/reports/stats'), authFetch('/orders/stats')]);
      const r = await rRes.json();
      const o = await oRes.json();
      document.getElementById('stat-today').textContent = r.rapportsAujourdhui ?? '0';
      document.getElementById('stat-encours').textContent = r.pannesAujourdhui ?? '0';
      document.getElementById('stat-attente').textContent = o.enAttente ?? '0';
    } catch (e) {
      /* hors connexion */
    }
  }

  // ---------- annonces ----------
  const DISMISSED_KEY = 'unifood_technicien_dismissed_announcement';
  function typeStampClass(type) {
    if (type === 'Annonce importante') return 'raspberry';
    if (type === 'Planning de la semaine') return 'mint';
    return 'amber';
  }
  function attachmentsHtml(fichiers) {
    if (!fichiers || !fichiers.length) return '';
    const imgs = fichiers
      .filter((f) => (f.contentType || '').startsWith('image/'))
      .map((f) => `<img class="att-img" data-src="/announcements/files/${f._id}" alt="${escapeHtml(f.nomFichier)}">`)
      .join('');
    const docs = fichiers
      .filter((f) => !(f.contentType || '').startsWith('image/'))
      .map((f) => `<button type="button" class="att-chip" data-file="${f._id}">${icon('fileText', 15)} ${escapeHtml(truncate(f.nomFichier, 30))}</button>`)
      .join('');
    return `<div class="att-grid">${imgs}${docs}</div>`;
  }
  function wireAttachments(container) {
    hydrateImages(container);
    container.querySelectorAll('[data-file]').forEach((b) => b.addEventListener('click', () => viewFile(`/announcements/files/${b.dataset.file}`)));
  }

  async function loadAnnouncementBanner() {
    const banner = document.getElementById('announcement-banner');
    let list = [];
    try {
      list = await (await authFetch('/announcements')).json();
    } catch (e) {
      return;
    }
    if (!list.length || localStorage.getItem(DISMISSED_KEY) === list[0]._id) {
      banner.style.display = 'none';
      return;
    }
    const latest = list[0];
    banner.className = 'announcement-banner';
    banner.innerHTML = `
      <div class="ann-icon">${icon(latest.type === 'Planning de la semaine' ? 'calendar' : 'megaphone', 18)}</div>
      <div class="ann-body">
        <div class="ann-eyebrow">${escapeHtml(latest.type)} · ${escapeHtml(latest.auteur)}</div>
        <h4>${escapeHtml(latest.titre)}</h4>
        ${latest.contenu ? `<p>${escapeHtml(truncate(latest.contenu, 180))}</p>` : ''}
        ${attachmentsHtml(latest.fichiers)}
      </div>
      <button class="ann-close" id="ann-banner-close" title="Fermer">${icon('x', 16)}</button>`;
    banner.style.display = 'flex';
    document.getElementById('ann-banner-close').addEventListener('click', () => {
      localStorage.setItem(DISMISSED_KEY, latest._id);
      banner.style.display = 'none';
    });
    wireAttachments(banner);
  }

  async function loadAnnouncementsList() {
    const container = document.getElementById('announcements-list');
    container.innerHTML = `<div class="empty-state"><span class="spinner dark"></span></div>`;
    const list = await (await authFetch('/announcements')).json();
    if (!list.length) {
      container.innerHTML = `<div class="empty-state">${icon('bell', 34)}<p>Aucune annonce pour le moment.</p></div>`;
      return;
    }
    container.innerHTML = list
      .map(
        (a) => `
      <div class="announcement-card">
        <div class="ann-head"><h4>${escapeHtml(a.titre)}</h4><span class="stamp ${typeStampClass(a.type)}">${escapeHtml(a.type)}</span></div>
        <div class="ann-meta">Publié par ${escapeHtml(a.auteur)} · ${formatDateFR(a.createdAt)}${a.expireLe ? ` · Valable jusqu'au ${formatDateFR(a.expireLe)}` : ''}</div>
        ${a.contenu ? `<div class="ann-content">${escapeHtml(a.contenu)}</div>` : ''}
        ${attachmentsHtml(a.fichiers)}
      </div>`
      )
      .join('');
    wireAttachments(container);
  }

  // ---------- commande ----------
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
      const res = await authFetch('/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
      showToast('Pas de connexion : réessaie dans un instant.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Envoyer la commande';
    }
  });

  // ---------- mes rapports ----------
  async function loadReports() {
    const tbody = document.getElementById('reports-tbody');
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="spinner dark"></span></div></td></tr>`;
    const params = new URLSearchParams();
    const dateDebut = document.getElementById('fr-date-debut').value;
    const dateFin = document.getElementById('fr-date-fin').value;
    if (dateDebut) params.set('dateDebut', dateDebut);
    if (dateFin) params.set('dateFin', dateFin);
    const reports = await (await authFetch(`/reports?${params.toString()}`)).json();
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
        <td>${escapeHtml(horaireLabel(r.horaire))}</td>
        <td class="cell-muted">${r.entries.length ? `${r.entries.length} panne(s) — ${escapeHtml(truncate(machines, 40))}` : 'Rapport en photo'}${r.nbPhotos ? ` · ${icon('camera', 12)} ${r.nbPhotos}` : ''}</td>
        <td><span class="stamp ${stampClass(r.statutRapport)}">${escapeHtml(r.statutRapport)}</span></td>
        <td><button class="btn btn-ghost btn-sm view-report" data-id="${r._id}">${icon('eye', 15)}</button></td>
      </tr>`;
      })
      .join('');
    // Copie des photos sur ce téléphone (elles restent visibles après leur suppression de la base)
    if (window.PhotoCache) PhotoCache.sync(reports, authFetch);
    tbody.querySelectorAll('.view-report').forEach((b) => b.addEventListener('click', () => showReportModal(b.dataset.id)));
  }

  async function showReportModal(id) {
    const res = await authFetch(`/reports/${id}`);
    if (!res.ok) {
      showToast('Rapport introuvable.', 'error');
      return;
    }
    const r = await res.json();
    const rows = r.entries
      .map((e) => `<tr><td>${escapeHtml(e.machineConcernee)}</td><td>${escapeHtml(e.descriptionPanne)}</td><td>${escapeHtml(e.actionMenee)}</td><td>${escapeHtml(e.heureDebut)}</td><td>${escapeHtml(e.heureFin)}</td></tr>`)
      .join('') ||
      `<tr><td colspan="5" style="text-align:center; color:var(--gray);">${r.nbPhotos ? 'Rapport écrit envoyé en photo (voir ci-dessous).' : 'Aucune ligne.'}</td></tr>`;
    const photos = r.nbPhotos > 0 || (r.photos || []).length;
    openModal(
      `
      <button class="modal-close" id="modal-close">${icon('x', 16)}</button>
      <span class="stamp ${stampClass(r.statutRapport)}">${escapeHtml(r.statutRapport)}</span>
      <h2 style="margin-top:14px;">Fiche du ${formatDateFR(r.dateRapport)}</h2>
      <p style="color:var(--gray); font-size:0.85rem; margin-top:4px;">${escapeHtml(horaireLabel(r.horaire))} · ${escapeHtml(r.departement)} · Responsable : ${escapeHtml(r.responsableDepartement)}</p>
      <div class="table-wrap"><table class="modal-table">
        <thead><tr><th>Machine concernée</th><th>Panne ou observations</th><th>Tâche effectuée</th><th>Début</th><th>Fin</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${r.signature ? `<p class="cell-muted" style="margin-top:16px;">Signature</p><img class="modal-sig" src="${r.signature}" alt="Signature">` : ''}
      ${photos ? `<p class="cell-muted" style="margin-top:16px;">Photos jointes</p><p class="cell-muted" id="modal-photos-note" style="font-size:0.78rem;"></p><div class="att-grid" id="modal-photos"><span class="spinner dark"></span></div><button class="btn btn-outline btn-sm" id="modal-save-photos" style="margin-top:8px;" hidden>${icon('download', 14)} Enregistrer les photos</button>` : ''}
      <div class="form-actions" style="margin-top:18px;">
        <button class="btn btn-outline" id="modal-pdf">${icon('download', 15)} Télécharger le PDF</button>
      </div>`,
      true
    );
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-pdf').addEventListener('click', () => downloadFile(`/reports/${r._id}/pdf`, `rapport-${r._id}.pdf`));
    const photoBox = document.getElementById('modal-photos');
    if (photoBox) showReportPhotos(r, photoBox);
  }

  // Photos : base en ligne (30 jours) puis copie gardée sur ce téléphone
  async function showReportPhotos(r, box) {
    const note = document.getElementById('modal-photos-note');
    if (!window.PhotoCache) return hydrateImages(box);
    const info = await PhotoCache.render(box, r, authFetch);
    if (!info.total) {
      box.innerHTML = '';
      note.textContent = "Photos supprimées de la base après 30 jours et absentes de ce téléphone. L'administrateur en garde une sauvegarde.";
      return;
    }
    note.textContent = info.localOnly
      ? 'Supprimées de la base en ligne — affichées depuis la copie gardée sur ce téléphone.'
      : 'Une copie est gardée sur ce téléphone (la base en ligne les garde 30 jours).';
    const btn = document.getElementById('modal-save-photos');
    btn.hidden = false;
    btn.addEventListener('click', () => PhotoCache.saveFiles(info.blobs, `rapport-${String(r.dateRapport).slice(0, 10)}`));
  }

  document.getElementById('fr-btn-filtrer').addEventListener('click', loadReports);
  document.getElementById('fr-btn-reset').addEventListener('click', () => {
    document.getElementById('fr-date-debut').value = '';
    document.getElementById('fr-date-fin').value = '';
    loadReports();
  });

  // ---------- mes commandes ----------
  async function loadOrders() {
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><span class="spinner dark"></span></div></td></tr>`;
    const params = new URLSearchParams();
    const statutCommande = document.getElementById('fo-statut').value;
    const urgence = document.getElementById('fo-urgence').value;
    if (statutCommande) params.set('statutCommande', statutCommande);
    if (urgence) params.set('urgence', urgence);
    const orders = await (await authFetch(`/orders?${params.toString()}`)).json();
    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state">${icon('cart', 34)}<p>Aucune commande pour ces filtres.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = orders
      .map((o) => {
        const designations = o.items.map((it) => it.designation).join(', ');
        return `<tr>
        <td class="cell-mono">${formatDateFR(o.dateCommande)}</td>
        <td class="cell-muted">${o.items.length} article(s) — ${escapeHtml(truncate(designations, 40))}</td>
        <td><button class="btn btn-ghost btn-sm view-order" data-id="${o._id}">${icon('eye', 15)}</button></td>
      </tr>`;
      })
      .join('');
    tbody.querySelectorAll('.view-order').forEach((b) => b.addEventListener('click', () => showOrderModal(orders.find((o) => o._id === b.dataset.id))));
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
          ${it.noteResponsable ? `<div class="detail-item full"><label>Note de l'administrateur</label><p>${escapeHtml(it.noteResponsable)}</p></div>` : ''}
        </div>
      </div>`
      )
      .join('');
    openModal(`
      <button class="modal-close" id="modal-close">${icon('x', 16)}</button>
      <h2 style="margin-top:14px;">Commande du ${formatDateFR(o.dateCommande)}</h2>
      <p style="color:var(--gray); font-size:0.85rem; margin-top:4px;">${escapeHtml(o.departement)} · ${o.items.length} article(s)</p>
      ${itemsHtml}
      <div class="form-actions" style="margin-top:18px;"><button class="btn btn-outline" id="modal-pdf">${icon('download', 15)} PDF</button></div>`);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-pdf').addEventListener('click', () => downloadFile(`/orders/${o._id}/pdf`, `commande-${o._id}.pdf`));
  }

  document.getElementById('fo-btn-filtrer').addEventListener('click', loadOrders);
  document.getElementById('fo-btn-reset').addEventListener('click', () => {
    document.getElementById('fo-statut').value = '';
    document.getElementById('fo-urgence').value = '';
    loadOrders();
  });

  // ---------- API partagée avec fiche.js / magasin.js ----------
  window.UF = {
    auth,
    authFetch,
    showToast,
    escapeHtml,
    formatDateFR,
    formatDateTimeFR,
    horaireLabel,
    stampClass,
    icon,
    openModal,
    closeModal,
    hydrateImages,
    getDepartments: () => departments,
    refreshAfterSend: () => {
      loadStats();
      loadReports();
    },
    activateTab,
    reloadAnnouncements: () => {
      loadAnnouncementBanner();
      if (document.getElementById('panel-annonces').classList.contains('active')) loadAnnouncementsList();
    },
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
      await loadAnnouncementBanner();
      document.getElementById('page-loader').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      window.UF._fire();
    } catch (err) {
      if (err && err.message === 'Session expirée') return;
      if (!navigator.onLine) {
        document.getElementById('page-loader').innerHTML = '<p style="padding:24px; text-align:center;">Pas de connexion internet. Ta fiche en cours est gardée sur ce téléphone : réessaie dès que le réseau revient.</p>';
        return;
      }
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.href = 'index.html';
    }
  }
  boot();
})();
