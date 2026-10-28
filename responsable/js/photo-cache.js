// Copie locale des photos de rapports (IndexedDB de l'appareil).
// La base en ligne supprime les photos après 30 jours ; la copie gardée ici reste
// consultable dans l'application tant que les données du navigateur ne sont pas effacées.
(function () {
  const DB_NAME = 'unifood-photos';
  const STORE = 'photos';
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponible'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'photoId' });
        store.createIndex('reportId', 'reportId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // Demande au navigateur de ne pas effacer ces données quand l'espace manque
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    } catch (e) {
      /* ignoré */
    }
    return dbPromise;
  }

  function run(mode, fn) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const out = fn(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
          tx.onerror = () => reject(tx.error);
        })
    );
  }

  const PhotoCache = {
    async get(photoId) {
      try {
        const rec = await run('readonly', (s) => s.get(String(photoId)));
        return rec ? rec.blob : null;
      } catch (e) {
        return null;
      }
    },
    async put(photoId, reportId, blob, meta = {}) {
      try {
        await run('readwrite', (s) => s.put({ photoId: String(photoId), reportId: String(reportId), blob, savedAt: Date.now(), ...meta }));
      } catch (e) {
        /* stockage plein ou indisponible : on continue sans copie locale */
      }
    },
    async byReport(reportId) {
      try {
        const list = await run('readonly', (s) => s.index('reportId').getAll(String(reportId)));
        return (list || []).sort((a, b) => a.savedAt - b.savedAt);
      } catch (e) {
        return [];
      }
    },
    async removeReport(reportId) {
      const list = await PhotoCache.byReport(reportId);
      if (!list.length) return;
      try {
        await run('readwrite', (s) => list.forEach((p) => s.delete(p.photoId)));
      } catch (e) {
        /* ignoré */
      }
    },

    // Télécharge en arrière-plan les photos pas encore copiées sur l'appareil.
    // authFetch : fonction de l'application (avec le jeton de connexion).
    async sync(reports, authFetch) {
      const todo = (reports || []).filter((r) => r.nbPhotos > 0).slice(0, 40);
      for (const r of todo) {
        const have = await PhotoCache.byReport(r._id);
        if (have.length >= r.nbPhotos) continue;
        try {
          const res = await authFetch(`/reports/${r._id}`);
          if (!res.ok) continue;
          const detail = await res.json();
          const known = new Set(have.map((p) => p.photoId));
          for (const p of detail.photos || []) {
            if (known.has(String(p._id))) continue;
            const img = await authFetch(`/reports/photo/${p._id}`);
            if (img.ok) await PhotoCache.put(p._id, r._id, await img.blob(), { dateRapport: r.dateRapport, technicienNom: r.technicienNom });
          }
        } catch (e) {
          return; // hors connexion : on réessaiera au prochain chargement
        }
      }
    },

    // Affiche les photos d'une fiche : serveur si disponible, sinon copie locale.
    // Retourne le nombre de photos affichées.
    async render(container, report, authFetch) {
      const server = report.photos || [];
      const local = await PhotoCache.byReport(report._id);
      const localById = new Map(local.map((p) => [p.photoId, p.blob]));
      const items = [];
      for (const p of server) {
        let blob = localById.get(String(p._id));
        if (!blob) {
          try {
            const res = await authFetch(`/reports/photo/${p._id}`);
            if (res.ok) {
              blob = await res.blob();
              await PhotoCache.put(p._id, report._id, blob, { dateRapport: report.dateRapport, technicienNom: report.technicienNom });
            }
          } catch (e) {
            /* ignoré */
          }
        }
        if (blob) items.push(blob);
        localById.delete(String(p._id));
      }
      // Photos supprimées de la base mais gardées sur cet appareil
      const onlyLocal = [...localById.values()];
      items.push(...onlyLocal);
      container.innerHTML = '';
      items.forEach((blob) => {
        const url = URL.createObjectURL(blob);
        const img = document.createElement('img');
        img.className = 'att-img';
        img.src = url;
        img.alt = 'Photo du rapport';
        img.addEventListener('click', () => window.open(url, '_blank'));
        container.appendChild(img);
      });
      return { total: items.length, localOnly: onlyLocal.length, blobs: items };
    },

    // Enregistre les photos d'une fiche comme fichiers (PC, téléphone, puis Drive)
    saveFiles(blobs, baseName) {
      blobs.forEach((blob, i) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${baseName}-photo${i + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    },
  };

  window.PhotoCache = PhotoCache;
})();
