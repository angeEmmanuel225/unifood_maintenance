const Report = require('../models/Report');
const generateReportPDF = require('../utils/generateReportPDF');
const generateReportsBulkPDF = require('../utils/generateReportsBulkPDF');

function buildFilters(req) {
  const { departement, statutPanne, statutRapport, dateDebut, dateFin, technicien, q } = req.query;
  const filters = {};

  if (req.user.role === 'technicien') {
    filters.technicien = req.user._id;
  } else if (technicien) {
    filters.technicien = technicien;
  }

  if (departement) filters.departement = departement;
  if (statutPanne) filters.statutPanne = statutPanne;
  if (statutRapport) filters.statutRapport = statutRapport;

  if (dateDebut || dateFin) {
    filters.dateRapport = {};
    if (dateDebut) filters.dateRapport.$gte = new Date(dateDebut);
    if (dateFin) {
      const end = new Date(dateFin);
      end.setHours(23, 59, 59, 999);
      filters.dateRapport.$lte = end;
    }
  }

  if (q) {
    filters.$or = [
      { machineConcernee: { $regex: q, $options: 'i' } },
      { descriptionPanne: { $regex: q, $options: 'i' } },
      { technicienNom: { $regex: q, $options: 'i' } },
    ];
  }

  return filters;
}

// POST /api/reports
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

    const report = await Report.create({
      technicien: req.user._id,
      technicienNom: `${req.user.prenom} ${req.user.nom}`,
      departement,
      responsableDepartement,
      horaire,
      dateRapport,
      machineConcernee,
      descriptionPanne,
      actionMenee,
      heureDebut,
      heureFin,
      statutPanne: statutPanne || 'Résolue',
      observations,
    });

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la création du rapport.', error: err.message });
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

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [rapportsAujourdhui, pannesEnCours, nonResolues, totalRapports] = await Promise.all([
      Report.countDocuments({ ...baseFilter, dateRapport: { $gte: startOfDay, $lte: endOfDay } }),
      Report.countDocuments({ ...baseFilter, statutPanne: 'En cours' }),
      Report.countDocuments({ ...baseFilter, statutPanne: 'Non résolue' }),
      Report.countDocuments(baseFilter),
    ]);

    res.json({ rapportsAujourdhui, pannesEnCours, nonResolues, totalRapports });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du calcul des statistiques.', error: err.message });
  }
};

// GET /api/reports/export/pdf
exports.exportReportsPDF = async (req, res) => {
  try {
    const filters = buildFilters(req);
    const reports = await Report.find(filters).sort({ dateRapport: -1, createdAt: -1 }).limit(200);
    generateReportsBulkPDF(reports, res);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de l'export PDF des rapports.", error: err.message });
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

    generateReportPDF(report, res);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la génération du PDF.', error: err.message });
  }
};

// PATCH /api/reports/:id/statut  (responsable uniquement)
exports.updateReportStatus = async (req, res) => {
  try {
    const { statutRapport, statutPanne } = req.body;
    const update = {};
    if (statutRapport) update.statutRapport = statutRapport;
    if (statutPanne) update.statutPanne = statutPanne;

    const report = await Report.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!report) return res.status(404).json({ message: 'Rapport introuvable.' });

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du rapport.', error: err.message });
  }
};
