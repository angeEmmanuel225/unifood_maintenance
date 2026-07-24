const Report = require('../models/Report');
const generateReportPDF = require('../utils/generateReportPDF');
const generateReportsBulkPDF = require('../utils/generateReportsBulkPDF');

function toDayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildFilters(req) {
  const { departement, statutPanne, statutRapport, dateDebut, dateFin, technicien, q } = req.query;
  const filters = {};

  if (req.user.role === 'technicien') {
    filters.technicien = req.user._id;
  } else if (technicien) {
    filters.technicien = technicien;
  }

  if (departement) filters.departement = departement;
  if (statutRapport) filters.statutRapport = statutRapport;
  if (statutPanne) filters['entries.statutPanne'] = statutPanne;

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
      { technicienNom: { $regex: q, $options: 'i' } },
    ];
  }

  return filters;
}

// POST /api/reports — ajoute une panne/action à la fiche du jour (la crée si elle n'existe pas encore)
exports.createReport = async (req, res) => {
  try {
    const {
      departement,
      responsableDepartement,
      horaire,
      dateRapport,
      machineConcernee,
      descriptionPanne,
      actionMenee,
      heureDebut,
      heureFin,
      statutPanne,
      observations,
    } = req.body;

    if (!departement || !responsableDepartement || !horaire || !dateRapport || !machineConcernee || !descriptionPanne || !actionMenee || !heureDebut || !heureFin) {
      return res.status(400).json({ message: 'Merci de renseigner tous les champs obligatoires du rapport.' });
    }

    const day = toDayStart(dateRapport);
    const entry = {
      machineConcernee,
      descriptionPanne,
      actionMenee,
      heureDebut,
      heureFin,
      statutPanne: statutPanne || 'Résolue',
      observations,
    };

    const report = await Report.findOneAndUpdate(
      { technicien: req.user._id, dateRapport: day },
      {
        $push: { entries: entry },
        $set: {
          departement,
          responsableDepartement,
          horaire,
          technicienNom: `${req.user.prenom} ${req.user.nom}`,
          statutRapport: 'Nouveau',
          exporte: false,
        },
        $setOnInsert: { technicien: req.user._id, dateRapport: day },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de l'enregistrement du rapport.", error: err.message });
  }
};

// GET /api/reports
exports.getReports = async (req, res) => {
  try {
    const filters = buildFilters(req);
    const reports = await Report.find(filters).sort({ dateRapport: -1, createdAt: -1 }).limit(500);
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

    const [rapportsAujourdhui, pannesEnCours, nonResolues, totalRapports] = await Promise.all([
      Report.countDocuments({ ...baseFilter, dateRapport: { $gte: startOfDay, $lte: endOfDay } }),
      Report.countDocuments({ ...baseFilter, 'entries.statutPanne': 'En cours' }),
      Report.countDocuments({ ...baseFilter, 'entries.statutPanne': 'Non résolue' }),
      Report.countDocuments(baseFilter),
    ]);

    res.json({ rapportsAujourdhui, pannesEnCours, nonResolues, totalRapports });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du calcul des statistiques.', error: err.message });
  }
};

// GET /api/reports/export/pdf (export groupé, responsable) — accepte les mêmes filtres que la liste
exports.exportReportsPDF = async (req, res) => {
  try {
    const filters = buildFilters(req);
    const reports = await Report.find(filters).sort({ dateRapport: -1, createdAt: -1 }).limit(300);
    await Report.updateMany({ _id: { $in: reports.map((r) => r._id) } }, { $set: { exporte: true } });
    generateReportsBulkPDF(reports, res);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de l'export PDF des rapports.", error: err.message });
  }
};

// DELETE /api/reports/bulk?dateDebut=&dateFin=&departement=... (responsable) — nécessite au moins une date
exports.bulkDeleteReports = async (req, res) => {
  try {
    if (!req.query.dateDebut && !req.query.dateFin) {
      return res.status(400).json({ message: 'Précise au moins une date (début ou fin) avant une suppression groupée.' });
    }
    const filters = buildFilters(req);
    const result = await Report.deleteMany(filters);
    res.json({ message: `${result.deletedCount} fiche(s) supprimée(s).`, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression groupée.', error: err.message });
  }
};

// GET /api/reports/:id
exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Rapport introuvable.' });

    if (req.user.role === 'technicien' && String(report.technicien) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Accès refusé à ce rapport.' });
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération du rapport.', error: err.message });
  }
};

// GET /api/reports/:id/pdf
exports.downloadReportPDF = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Rapport introuvable.' });

    if (req.user.role === 'technicien' && String(report.technicien) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Accès refusé à ce rapport.' });
    }

    report.exporte = true;
    await report.save();

    generateReportPDF(report, res);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la génération du PDF.', error: err.message });
  }
};

// PATCH /api/reports/:id/statut (responsable uniquement)
exports.updateReportStatus = async (req, res) => {
  try {
    const { statutRapport } = req.body;
    const report = await Report.findByIdAndUpdate(req.params.id, { statutRapport }, { new: true, runValidators: true });
    if (!report) return res.status(404).json({ message: 'Rapport introuvable.' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du rapport.', error: err.message });
  }
};

// DELETE /api/reports/:id (responsable uniquement)
exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);
    if (!report) return res.status(404).json({ message: 'Rapport introuvable.' });
    res.json({ message: 'Rapport supprimé.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression.', error: err.message });
  }
};
