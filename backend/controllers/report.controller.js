const Report = require('../models/Report');
const ReportPhoto = require('../models/ReportPhoto');
const ReportDraft = require('../models/ReportDraft');
const Department = require('../models/Department');
const generateReportPDF = require('../utils/generateReportPDF');
const generateReportsBulkPDF = require('../utils/generateReportsBulkPDF');

const MAX_ROWS = 60;
const MAX_PHOTOS_PER_REQUEST = 3;
const MAX_PHOTOS_PER_REPORT = 6;
const MAX_PHOTO_BYTES = 450 * 1024;
const MAX_SIGNATURE_BYTES = 60 * 1024;
const MAX_DRAFT_CHARS = 80000;

function toDayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function decodeDataUrl(dataUrl, allowedMimes) {
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(dataUrl || ''));
  if (!m || !allowedMimes.includes(m[1])) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
}

function fullName(user) {
  return `${user.prenom === '-' ? '' : user.prenom} ${user.nom}`.trim();
}

function buildFilters(req) {
  const { departement, statutRapport, dateDebut, dateFin, technicien, q } = req.query;
  const filters = {};
  if (req.user.role === 'technicien') filters.technicien = req.user._id;
  else if (technicien) filters.technicien = technicien;
  if (departement) filters.departement = departement;
  if (statutRapport) filters.statutRapport = statutRapport;
  if (req.user.role === 'responsable' && req.query.nonExportes === '1') filters.exporte = false;
  if (dateDebut || dateFin) {
    filters.dateRapport = {};
    if (dateDebut) filters.dateRapport.$gte = toDayStart(dateDebut);
    if (dateFin) {
      const end = new Date(dateFin);
      end.setHours(23, 59, 59, 999);
      filters.dateRapport.$lte = end;
    }
  }
  if (q) {
    filters.$or = [
      { 'entries.machineConcernee': { $regex: q, $options: 'i' } },
      { 'entries.descriptionPanne': { $regex: q, $options: 'i' } },
      { 'entries.actionMenee': { $regex: q, $options: 'i' } },
      { technicienNom: { $regex: q, $options: 'i' } },
    ];
  }
  return filters;
}

async function loadPhotosFor(reportIds) {
  const photos = await ReportPhoto.find({ report: { $in: reportIds } }).select('+data').sort({ createdAt: 1 });
  const map = new Map();
  photos.forEach((p) => {
    const key = String(p.report);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  });
  return map;
}

// POST /api/reports — envoie la fiche (toutes les lignes du tableau d'un coup)
exports.createReport = async (req, res) => {
  try {
    const { departement, responsableDepartement, horaire, dateRapport, entries, signature, photos } = req.body;

    if (!responsableDepartement) return res.status(400).json({ message: 'Coche le responsable de département.' });
    if (!Report.HORAIRES.includes(horaire)) return res.status(400).json({ message: "Choisis l'horaire de travail." });
    if (!dateRapport || Number.isNaN(new Date(dateRapport).getTime())) return res.status(400).json({ message: 'La date est invalide.' });
    if (!departement) return res.status(400).json({ message: 'Département manquant.' });
    const hasPhotos = Array.isArray(photos) && photos.length > 0;
    if (entries !== undefined && entries !== null && !Array.isArray(entries)) return res.status(400).json({ message: 'Tableau invalide.' });
    const rawEntries = Array.isArray(entries) ? entries : [];
    if (!rawEntries.length && !hasPhotos) return res.status(400).json({ message: 'Remplis le tableau ou ajoute la photo de ton rapport écrit.' });
    if (rawEntries.length > MAX_ROWS) return res.status(400).json({ message: `Maximum ${MAX_ROWS} lignes par envoi.` });

    const cleaned = [];
    for (let i = 0; i < rawEntries.length; i++) {
      const e = rawEntries[i] || {};
      const machine = String(e.machineConcernee || '').trim();
      const panne = String(e.descriptionPanne || '').trim();
      const tache = String(e.actionMenee || '').trim();
      if (!machine && !panne && !tache) continue; // ligne vide ignorée
      if (!machine || !panne) return res.status(400).json({ message: `Ligne ${i + 1} : indique la machine et la panne ou l'observation.` });
      const hd = String(e.heureDebut || '');
      const hf = String(e.heureFin || '');
      cleaned.push({
        machineConcernee: machine.slice(0, 120),
        descriptionPanne: panne.slice(0, 2000),
        actionMenee: tache.slice(0, 2000),
        heureDebut: /^\d{2}:\d{2}$/.test(hd) ? hd : '',
        heureFin: /^\d{2}:\d{2}$/.test(hf) ? hf : '',
      });
    }
    // Une photo du rapport écrit suffit : le tableau peut alors rester vide
    if (!cleaned.length && !hasPhotos) return res.status(400).json({ message: 'Remplis le tableau ou ajoute la photo de ton rapport écrit.' });

    const sig = decodeDataUrl(signature, ['image/png']);
    if (!sig) return res.status(400).json({ message: "Merci de signer la fiche avant de l'envoyer." });
    if (sig.buffer.length > MAX_SIGNATURE_BYTES) return res.status(400).json({ message: 'Signature trop lourde.' });

    const photoDocs = [];
    if (photos !== undefined && photos !== null) {
      if (!Array.isArray(photos) || photos.length > MAX_PHOTOS_PER_REQUEST) {
        return res.status(400).json({ message: `Maximum ${MAX_PHOTOS_PER_REQUEST} photos par envoi.` });
      }
      for (const p of photos) {
        const dec = decodeDataUrl(p, ['image/jpeg', 'image/png']);
        if (!dec) return res.status(400).json({ message: 'Une des photos est invalide.' });
        if (dec.buffer.length > MAX_PHOTO_BYTES) return res.status(400).json({ message: 'Une photo est trop lourde (max 450 Ko après compression).' });
        photoDocs.push(dec);
      }
    }

    const day = toDayStart(dateRapport);
    if (photoDocs.length) {
      const existing = await Report.findOne({ technicien: req.user._id, dateRapport: day }).select('nbPhotos');
      if (existing && existing.nbPhotos + photoDocs.length > MAX_PHOTOS_PER_REPORT) {
        return res.status(400).json({ message: `Cette fiche a déjà ${existing.nbPhotos} photo(s) (maximum ${MAX_PHOTOS_PER_REPORT}).` });
      }
    }

    // Ajoute les lignes à la fiche du jour (la crée si c'est le premier envoi de la journée)
    await Report.updateOne(
      { technicien: req.user._id, dateRapport: day },
      {
        $push: { entries: { $each: cleaned } },
        $set: {
          departement,
          responsableDepartement,
          horaire,
          technicienNom: fullName(req.user),
          signature: `data:image/png;base64,${sig.buffer.toString('base64')}`,
          statutRapport: 'Nouveau',
          exporte: false,
        },
      },
      { upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    const report = await Report.findOne({ technicien: req.user._id, dateRapport: day }).select('_id entries');

    if (photoDocs.length) {
      await ReportPhoto.insertMany(
        photoDocs.map((p) => ({ report: report._id, technicien: req.user._id, data: p.buffer, contentType: p.mime, taille: p.buffer.length }))
      );
      await Report.updateOne({ _id: report._id }, { $inc: { nbPhotos: photoDocs.length } });
    }

    // La fiche est partie : le brouillon n'a plus lieu d'être
    await ReportDraft.deleteOne({ technicien: req.user._id });

    res.status(201).json({ message: 'Fiche envoyée.', id: report._id, lignes: report.entries.length, photos: photoDocs.length });
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de l'envoi du rapport.", error: err.message });
  }
};

// ----- Brouillon (sauvegarde automatique) -----
// GET /api/reports/draft/me
exports.getDraft = async (req, res) => {
  try {
    const draft = await ReportDraft.findOne({ technicien: req.user._id });
    if (!draft || !draft.payload) return res.json({ data: null });
    res.json({ data: JSON.parse(draft.payload), updatedAt: draft.updatedAt });
  } catch (err) {
    res.json({ data: null });
  }
};

// PUT /api/reports/draft/me
exports.saveDraft = async (req, res) => {
  try {
    const payload = JSON.stringify(req.body && req.body.data ? req.body.data : {});
    if (payload.length > MAX_DRAFT_CHARS) return res.status(400).json({ message: 'Brouillon trop volumineux.' });
    await ReportDraft.updateOne({ technicien: req.user._id }, { $set: { payload, updatedAt: new Date() } }, { upsert: true });
    res.json({ ok: true, updatedAt: new Date() });
  } catch (err) {
    res.status(500).json({ message: 'Erreur de sauvegarde du brouillon.', error: err.message });
  }
};

// DELETE /api/reports/draft/me
exports.deleteDraft = async (req, res) => {
  try {
    await ReportDraft.deleteOne({ technicien: req.user._id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur.', error: err.message });
  }
};

// GET /api/reports
exports.getReports = async (req, res) => {
  try {
    const reports = await Report.find(buildFilters(req)).sort({ dateRapport: -1, createdAt: -1 }).limit(500);
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des rapports.', error: err.message });
  }
};

// GET /api/reports/stats
exports.getStats = async (req, res) => {
  try {
    const baseFilter = req.user.role === 'technicien' ? { technicien: req.user._id } : {};
    const startOfDay = toDayStart(new Date());
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);
    const today = { ...baseFilter, dateRapport: { $gte: startOfDay, $lte: endOfDay } };
    const [rapportsAujourdhui, totalRapports, todayDocs] = await Promise.all([
      Report.countDocuments(today),
      Report.countDocuments(baseFilter),
      Report.find(today).select('entries.machineConcernee'),
    ]);
    const pannesAujourdhui = todayDocs.reduce((sum, r) => sum + r.entries.length, 0);
    res.json({ rapportsAujourdhui, totalRapports, pannesAujourdhui });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du calcul des statistiques.', error: err.message });
  }
};

// GET /api/reports/export/pdf (administrateur) — mêmes filtres que la liste, signature + photos incluses
exports.exportReportsPDF = async (req, res) => {
  try {
    // Sauvegarde (nonExportes=1) : les plus anciennes d'abord, par lots de 150
    const order = req.query.nonExportes === '1' ? 1 : -1;
    const reports = await Report.find(buildFilters(req)).select('+signature').sort({ dateRapport: order, createdAt: order }).limit(150);
    const ids = reports.map((r) => r._id);
    await Report.updateMany({ _id: { $in: ids } }, { $set: { exporte: true } });
    const departments = await Department.find().sort({ ordre: 1, nom: 1 });
    const photosByReport = await loadPhotosFor(ids);
    generateReportsBulkPDF(reports, res, { departments, photosByReport });
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de l'export PDF des rapports.", error: err.message });
  }
};

// GET /api/reports/backup-status (administrateur) — alerte de sauvegarde avant suppression des photos
const DAY_MS = 24 * 3600 * 1000;
exports.getBackupStatus = async (req, res) => {
  try {
    const days = ReportPhoto.RETENTION_DAYS;
    const now = Date.now();
    // Photos qui seront supprimées de la base dans 7 jours ou moins
    const soon = await ReportPhoto.find({ createdAt: { $lt: new Date(now - (days - 7) * DAY_MS) } }).select('report createdAt');
    const firstPhoto = new Map();
    soon.forEach((p) => {
      const k = String(p.report);
      if (!firstPhoto.has(k) || p.createdAt < firstPhoto.get(k)) firstPhoto.set(k, p.createdAt);
    });
    const urgent = firstPhoto.size
      ? await Report.find({ _id: { $in: [...firstPhoto.keys()] }, exporte: false }).select('_id')
      : [];
    let premiereSuppression = null;
    urgent.forEach((r) => {
      const d = new Date(firstPhoto.get(String(r._id)).getTime() + days * DAY_MS);
      if (!premiereSuppression || d < premiereSuppression) premiereSuppression = d;
    });
    const [enRetard, nonExportes] = await Promise.all([
      Report.countDocuments({ exporte: false, dateRapport: { $lt: new Date(now - 20 * DAY_MS) } }),
      Report.countDocuments({ exporte: false }),
    ]);
    res.json({ urgents: urgent.length, premiereSuppression, enRetard, nonExportes, retentionJours: days });
  } catch (err) {
    res.status(500).json({ message: 'Erreur.', error: err.message });
  }
};

// DELETE /api/reports/bulk?dateDebut=&dateFin= (administrateur) — au moins une date obligatoire
exports.bulkDeleteReports = async (req, res) => {
  try {
    if (!req.query.dateDebut && !req.query.dateFin) {
      return res.status(400).json({ message: 'Précise au moins une date (début ou fin) avant une suppression groupée.' });
    }
    const ids = (await Report.find(buildFilters(req)).select('_id')).map((r) => r._id);
    await ReportPhoto.deleteMany({ report: { $in: ids } });
    const result = await Report.deleteMany({ _id: { $in: ids } });
    res.json({ message: `${result.deletedCount} fiche(s) supprimée(s).`, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression groupée.', error: err.message });
  }
};

async function findAccessibleReport(req, res, withSignature = false) {
  let query = Report.findById(req.params.id);
  if (withSignature) query = query.select('+signature');
  const report = await query;
  if (!report) {
    res.status(404).json({ message: 'Rapport introuvable.' });
    return null;
  }
  if (req.user.role === 'technicien' && String(report.technicien) !== String(req.user._id)) {
    res.status(403).json({ message: 'Accès refusé à ce rapport.' });
    return null;
  }
  return report;
}

// GET /api/reports/:id (avec signature + liste des photos)
exports.getReportById = async (req, res) => {
  try {
    const report = await findAccessibleReport(req, res, true);
    if (!report) return;
    const photos = await ReportPhoto.find({ report: report._id }).select('taille createdAt').sort({ createdAt: 1 });
    res.json({ ...report.toObject(), photos });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération du rapport.', error: err.message });
  }
};

// GET /api/reports/photo/:photoId
exports.getPhoto = async (req, res) => {
  try {
    const photo = await ReportPhoto.findById(req.params.photoId).select('+data');
    if (!photo) return res.status(404).json({ message: 'Photo introuvable (elle a peut-être expiré).' });
    if (req.user.role === 'technicien' && String(photo.technicien) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    res.setHeader('Content-Type', photo.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(photo.data);
  } catch (err) {
    res.status(500).json({ message: 'Erreur.', error: err.message });
  }
};

// GET /api/reports/:id/pdf
exports.downloadReportPDF = async (req, res) => {
  try {
    const report = await findAccessibleReport(req, res, true);
    if (!report) return;
    await Report.updateOne({ _id: report._id }, { $set: { exporte: true } });
    const departments = await Department.find().sort({ ordre: 1, nom: 1 });
    const photos = (await loadPhotosFor([report._id])).get(String(report._id)) || [];
    generateReportPDF(report, res, { departments, photos });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la génération du PDF.', error: err.message });
  }
};

// PATCH /api/reports/:id/statut (administrateur)
exports.updateReportStatus = async (req, res) => {
  try {
    const r = await Report.updateOne({ _id: req.params.id }, { statutRapport: req.body.statutRapport }, { runValidators: true });
    if (!r.matchedCount) return res.status(404).json({ message: 'Rapport introuvable.' });
    res.json(await Report.findById(req.params.id));
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du rapport.', error: err.message });
  }
};

// DELETE /api/reports/:id (administrateur)
exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).select('_id');
    if (!report) return res.status(404).json({ message: 'Rapport introuvable.' });
    await Report.deleteOne({ _id: report._id });
    await ReportPhoto.deleteMany({ report: report._id });
    res.json({ message: 'Rapport supprimé.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression.', error: err.message });
  }
};
