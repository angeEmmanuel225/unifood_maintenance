const Withdrawal = require('../models/Withdrawal');
const { generateWithdrawalsExcelBuffer } = require('../utils/generateWithdrawalsExcel');

function fullName(user) {
  return `${user.prenom === '-' ? '' : user.prenom} ${user.nom}`.trim();
}

function buildFilters(req) {
  const { departement, statut, dateDebut, dateFin, technicien, q } = req.query;
  const filters = {};
  if (req.user.role === 'technicien') filters.technicien = req.user._id;
  else if (technicien) filters.technicien = technicien;
  if (departement) filters.departement = departement;
  if (statut) filters.statut = statut;
  if (dateDebut || dateFin) {
    filters.createdAt = {};
    if (dateDebut) {
      const d = new Date(dateDebut);
      d.setHours(0, 0, 0, 0);
      filters.createdAt.$gte = d;
    }
    if (dateFin) {
      const end = new Date(dateFin);
      end.setHours(23, 59, 59, 999);
      filters.createdAt.$lte = end;
    }
  }
  if (q) {
    filters.$or = [
      { 'items.designation': { $regex: q, $options: 'i' } },
      { 'items.reference': { $regex: q, $options: 'i' } },
      { 'items.machine': { $regex: q, $options: 'i' } },
      { technicienNom: { $regex: q, $options: 'i' } },
    ];
  }
  return filters;
}

// POST /api/withdrawals (technicien) — "j'ai pris ces pièces au magasin"
exports.createWithdrawal = async (req, res) => {
  try {
    const { items, note } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Ajoute au moins une pièce prise au magasin.' });
    if (items.length > 40) return res.status(400).json({ message: 'Maximum 40 pièces par bon.' });

    const cleaned = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      const designation = String(it.designation || '').trim();
      const reference = String(it.reference || '').trim();
      const machine = String(it.machine || '').trim();
      if (!designation && !reference && !machine && !it.quantite) continue;
      const quantite = Number(it.quantite);
      if (!designation) return res.status(400).json({ message: `Ligne ${i + 1} : indique la désignation de la pièce.` });
      if (!Number.isFinite(quantite) || quantite < 1) return res.status(400).json({ message: `Ligne ${i + 1} : la quantité doit être au moins 1.` });
      cleaned.push({
        designation: designation.slice(0, 200),
        reference: reference.slice(0, 80),
        quantite: Math.round(quantite * 100) / 100,
        unite: String(it.unite || 'pièce').slice(0, 20),
        machine: machine.slice(0, 120),
      });
    }
    if (!cleaned.length) return res.status(400).json({ message: 'Le bon est vide.' });

    const withdrawal = await Withdrawal.create({
      technicien: req.user._id,
      technicienNom: fullName(req.user),
      departement: req.user.departement || '',
      items: cleaned,
      note: String(note || '').trim().slice(0, 1000),
    });
    res.status(201).json(withdrawal);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de l'enregistrement de la sortie.", error: err.message });
  }
};

// GET /api/withdrawals
exports.getWithdrawals = async (req, res) => {
  try {
    res.json(await Withdrawal.find(buildFilters(req)).sort({ createdAt: -1 }).limit(500));
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des sorties.', error: err.message });
  }
};

// GET /api/withdrawals/stats
exports.getStats = async (req, res) => {
  try {
    const base = req.user.role === 'technicien' ? { technicien: req.user._id } : {};
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [nouvelles, aujourdhui] = await Promise.all([
      Withdrawal.countDocuments({ ...base, statut: 'Nouveau' }),
      Withdrawal.countDocuments({ ...base, createdAt: { $gte: start } }),
    ]);
    res.json({ nouvelles, aujourdhui });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du calcul des statistiques.', error: err.message });
  }
};

// PATCH /api/withdrawals/:id/vu (administrateur)
exports.markSeen = async (req, res) => {
  try {
    const r = await Withdrawal.updateOne({ _id: req.params.id }, { $set: { statut: 'Vu', vuPar: fullName(req.user), vuLe: new Date() } });
    if (!r.matchedCount) return res.status(404).json({ message: 'Sortie introuvable.' });
    res.json(await Withdrawal.findById(req.params.id));
  } catch (err) {
    res.status(500).json({ message: 'Erreur.', error: err.message });
  }
};

// POST /api/withdrawals/mark-all-seen (administrateur)
exports.markAllSeen = async (req, res) => {
  try {
    const r = await Withdrawal.updateMany({ statut: 'Nouveau' }, { $set: { statut: 'Vu', vuPar: fullName(req.user), vuLe: new Date() } });
    res.json({ modifie: r.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: 'Erreur.', error: err.message });
  }
};

// GET /api/withdrawals/export/excel (administrateur) — une ligne par pièce
exports.exportExcel = async (req, res) => {
  try {
    const list = await Withdrawal.find(buildFilters(req)).sort({ createdAt: -1 }).limit(2000);
    const rows = [];
    list.forEach((w) =>
      w.items.forEach((it) =>
        rows.push({
          date: w.createdAt,
          technicien: w.technicienNom,
          departement: w.departement,
          designation: it.designation,
          reference: it.reference,
          quantite: it.quantite,
          unite: it.unite,
          machine: it.machine,
          note: w.note,
          statut: w.statut,
        })
      )
    );
    const buffer = await generateWithdrawalsExcelBuffer(rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="sorties-magasin-${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de l'export Excel.", error: err.message });
  }
};

// DELETE /api/withdrawals/bulk (administrateur) — date obligatoire
exports.bulkDelete = async (req, res) => {
  try {
    if (!req.query.dateDebut && !req.query.dateFin) {
      return res.status(400).json({ message: 'Précise au moins une date (début ou fin) avant une suppression groupée.' });
    }
    const r = await Withdrawal.deleteMany(buildFilters(req));
    res.json({ message: `${r.deletedCount} sortie(s) supprimée(s).`, deletedCount: r.deletedCount });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression groupée.', error: err.message });
  }
};

// DELETE /api/withdrawals/:id (administrateur)
exports.deleteWithdrawal = async (req, res) => {
  try {
    const r = await Withdrawal.deleteOne({ _id: req.params.id });
    if (!r.deletedCount) return res.status(404).json({ message: 'Sortie introuvable.' });
    res.json({ message: 'Sortie supprimée.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression.', error: err.message });
  }
};
