// Gestion des comptes techniciens par l'administrateur : création (un ou plusieurs d'un coup),
// mots de passe, activation / désactivation, suppression.
(function () {
  if (!window.UF) return;
  window.UF.onReady(init);

  function init() {
    const { authFetch, showToast, escapeHtml: esc, icon, openModal, closeModal } = window.UF;
    const $ = (id) => document.getElementById(id);
    const depts = window.UF.getDepartments();

    $('ac-departement').innerHTML = depts.map((d) => `<option value="${esc(d.nom)}">${esc(d.nom)} — ${esc(d.responsable)}</option>`).join('');
    $('al-departement').innerHTML = '<option value="">Tous</option>' + depts.map((d) => `<option value="${esc(d.nom)}">${esc(d.nom)}</option>`).join('');

    function toCSV(comptes) {
      const header = ['Nom', 'Prénom', 'Département', 'Identifiant', 'Mot de passe'];
      const rows = comptes.map((c) => [c.nom, c.prenom === '-' ? '' : c.prenom, c.departement, c.identifiant, c.motDePasse]);
      const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
      return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
    }

    function showResults(comptes) {
      const rows = comptes
        .map((c) => `<tr><td>${esc(c.nom)}</td><td>${esc(c.prenom === '-' ? '' : c.prenom)}</td><td>${esc(c.departement)}</td><td class="cell-mono"><strong>${esc(c.identifiant)}</strong></td><td class="cell-mono" style="color:var(--raspberry); font-weight:700;">${esc(c.motDePasse)}</td></tr>`)
        .join('');
      $('ac-resultats').innerHTML = `
        <div class="no-print" style="background:var(--amber-bg); border:1px solid var(--amber); border-radius:10px; padding:12px 14px; font-size:0.84rem; margin-bottom:12px;">
          <strong>${comptes.length} compte(s) créé(s).</strong> Note ou télécharge ces accès <strong>maintenant</strong> : les mots de passe ne seront plus visibles après avoir quitté cette page (tu pourras toujours en définir un nouveau).
        </div>
        <div class="no-print form-actions" style="justify-content:flex-start; margin-bottom:12px;">
          <button class="btn btn-outline btn-sm" id="ac-csv">${icon('download', 15)} Télécharger (Excel / CSV)</button>
          <button class="btn btn-outline btn-sm" id="ac-print">${icon('fileText', 15)} Imprimer la liste</button>
        </div>
        <div id="print-area">
          <h3 style="margin-bottom:6px;">UNIFOOD TOGO — Accès techniciens</h3>
          <p style="font-size:0.8rem; color:var(--gray); margin-bottom:10px;">Confidentiel — ${new Date().toLocaleDateString('fr-FR')}</p>
          <div class="table-wrap"><table class="data-table"><thead><tr><th>Nom</th><th>Prénom</th><th>Département</th><th>Identifiant</th><th>Mot de passe</th></tr></thead><tbody>${rows}</tbody></table></div>
        </div>`;
      $('ac-csv').addEventListener('click', () => {
        const blob = new Blob([toCSV(comptes)], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `acces-techniciens-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
      $('ac-print').addEventListener('click', () => window.print());
    }

    $('ac-creer').addEventListener('click', async () => {
      const lignes = $('ac-lignes').value;
      if (!lignes.trim()) {
        showToast('Écris au moins un nom (un technicien par ligne).', 'error');
        return;
      }
      const btn = $('ac-creer');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Création...';
      try {
        const res = await authFetch('/users/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ departement: $('ac-departement').value, lignes, motDePasse: $('ac-motdepasse').value.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(data.message || 'Erreur lors de la création.', 'error');
          return;
        }
        showToast(`${data.total} compte(s) créé(s).`);
        showResults(data.comptes);
        $('ac-lignes').value = '';
        loadTechs();
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Créer les comptes';
      }
    });

    async function loadTechs() {
      const tbody = $('techs-tbody');
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="spinner dark"></span></div></td></tr>`;
      const p = new URLSearchParams();
      if ($('al-departement').value) p.set('departement', $('al-departement').value);
      if ($('al-recherche').value.trim()) p.set('q', $('al-recherche').value.trim());
      const list = await (await authFetch(`/users?${p.toString()}`)).json();
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">${icon('users', 34)}<p>Aucun technicien enregistré. Crée les comptes ci-dessus.</p></div></td></tr>`;
        return;
      }
      tbody.innerHTML = list
        .map(
          (u) => `
        <tr style="${u.actif ? '' : 'opacity:0.55;'}">
          <td><strong>${esc(u.nom)}</strong></td>
          <td>${esc(u.prenom === '-' ? '' : u.prenom)}</td>
          <td>${esc(u.departement)}</td>
          <td class="cell-mono">${esc(u.identifiant)}</td>
          <td><span class="stamp ${u.actif ? 'mint' : 'raspberry'}">${u.actif ? 'Actif' : 'Désactivé'}</span></td>
          <td style="white-space:nowrap;">
            <button class="btn btn-ghost btn-sm t-reset" data-id="${u.id}" title="Nouveau mot de passe">${icon('key', 15)}</button>
            <button class="btn btn-ghost btn-sm t-toggle" data-id="${u.id}" data-actif="${u.actif}" title="${u.actif ? 'Désactiver' : 'Réactiver'}">${icon(u.actif ? 'x' : 'check', 15)}</button>
            <button class="btn btn-ghost btn-sm t-del" data-id="${u.id}" data-name="${esc(u.nom + ' ' + (u.prenom === '-' ? '' : u.prenom))}" title="Supprimer" style="color:var(--raspberry);">${icon('trash', 15)}</button>
          </td>
        </tr>`
        )
        .join('');

      tbody.querySelectorAll('.t-reset').forEach((b) =>
        b.addEventListener('click', async () => {
          const typed = prompt('Nouveau mot de passe (laisse vide pour en générer un automatiquement) :');
          if (typed === null) return;
          const r = await authFetch(`/users/${b.dataset.id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motDePasse: typed.trim() }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) {
            showToast(d.message || 'Erreur.', 'error');
            return;
          }
          openModal(`
            <button class="modal-close" id="modal-close">${icon('x', 16)}</button>
            <h2>Nouveau mot de passe</h2>
            <p style="color:var(--gray); margin:6px 0 16px;">${esc(d.nom)} ${esc(d.prenom === '-' ? '' : d.prenom)}</p>
            <div class="detail-grid">
              <div class="detail-item"><label>Identifiant</label><p class="cell-mono"><strong>${esc(d.identifiant)}</strong></p></div>
              <div class="detail-item"><label>Mot de passe</label><p class="cell-mono" style="color:var(--raspberry); font-weight:700;">${esc(d.motDePasse)}</p></div>
            </div>
            <p class="cell-muted">Note-le maintenant : il ne sera plus affiché ensuite.</p>`);
          $('modal-close').addEventListener('click', closeModal);
        })
      );
      tbody.querySelectorAll('.t-toggle').forEach((b) =>
        b.addEventListener('click', async () => {
          const actif = b.dataset.actif === 'true';
          const r = await authFetch(`/users/${b.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actif: !actif }) });
          if (r.ok) {
            showToast(actif ? 'Accès désactivé.' : 'Accès réactivé.');
            loadTechs();
          }
        })
      );
      tbody.querySelectorAll('.t-del').forEach((b) =>
        b.addEventListener('click', async () => {
          if (!confirm(`Supprimer définitivement le compte de ${b.dataset.name} ? (ses rapports déjà envoyés sont conservés)`)) return;
          const r = await authFetch(`/users/${b.dataset.id}`, { method: 'DELETE' });
          if (r.ok) {
            showToast('Compte supprimé.');
            loadTechs();
          }
        })
      );
    }
    $('al-btn-filtrer').addEventListener('click', loadTechs);
    window.UF.loadTechs = loadTechs;
  }
})();
