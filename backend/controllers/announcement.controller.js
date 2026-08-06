const Announcement = require('../models/Announcement');

// POST /api/announcements (responsable uniquement)
exports.createAnnouncement = async (req, res) => {
  try {
    const { titre, contenu, type, expireLe } = req.body;
    if (!titre || !contenu) {
      return res.status(400).json({ message: 'Merci de renseigner un titre et un contenu.' });
    }
    if (type === 'Planning de la semaine' && !expireLe) {
      return res.status(400).json({ message: 'Merci de préciser jusqu\'à quand ce planning est valable.' });
    }

    const announcement = await Announcement.create({
      titre,
      contenu,
      type: type || 'Message',
      auteur: `${req.user.prenom} ${req.user.nom}`,
      expireLe: expireLe || null,
    });

    res.status(201).json(announcement);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de la publication de l'annonce.", error: err.message });
  }
};

// GET /api/announcements
// - technicien : uniquement les annonces actives
// - responsable : tout, y compris archivées (sauf si ?actif=true est précisé)
exports.getAnnouncements = async (req, res) => {
  try {
    const filters = {
      $or: [{ expireLe: null }, { expireLe: { $gt: new Date() } }],
    };
    if (req.user.role === 'technicien') {
      filters.actif = true;
    } else if (req.query.actif !== undefined) {
      filters.actif = req.query.actif === 'true';
    }

    const announcements = await Announcement.find(filters).sort({ createdAt: -1 }).limit(200);
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des annonces.', error: err.message });
  }
};

// PATCH /api/announcements/:id (responsable uniquement) — modifier ou archiver/réactiver
exports.updateAnnouncement = async (req, res) => {
  try {
    const { titre, contenu, type, actif, expireLe } = req.body;
    const update = {};
    if (titre !== undefined) update.titre = titre;
    if (contenu !== undefined) update.contenu = contenu;
    if (type !== undefined) update.type = type;
    if (actif !== undefined) update.actif = actif;
    if (expireLe !== undefined) update.expireLe = expireLe || null;

    const announcement = await Announcement.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!announcement) return res.status(404).json({ message: 'Annonce introuvable.' });

    res.json(announcement);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour.', error: err.message });
  }
};

// DELETE /api/announcements/:id (responsable uniquement)
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'Annonce introuvable.' });
    res.json({ message: 'Annonce supprimée.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression.', error: err.message });
  }
};
