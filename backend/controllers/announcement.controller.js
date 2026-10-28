const Announcement = require('../models/Announcement');
const AnnouncementFile = require('../models/AnnouncementFile');
const { notifyTechnicians } = require('../utils/push');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo par fichier
const MAX_FILES = 6;
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

// "2026-08-14" => fin de cette journée (le planning reste valable jusqu'au soir inclus)
function parseExpire(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return new Date(`${value}T23:59:59.999Z`);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Les navigateurs envoient parfois les noms de fichiers accentués mal décodés ("Ã©" au lieu de "é")
function fixFileName(name) {
  const n = String(name || 'fichier');
  if ([...n].some((ch) => ch.charCodeAt(0) > 0xff)) return n;
  const fixed = Buffer.from(n, 'latin1').toString('utf8');
  return fixed.includes('�') ? n : fixed;
}

function authorName(user) {
  return `${user.prenom === '-' ? '' : user.prenom} ${user.nom}`.trim();
}

async function attachFiles(announcement, files) {
  if (!files || !files.length) return;
  for (const f of files) {
    const doc = await AnnouncementFile.create({
      announcement: announcement._id,
      data: f.buffer,
      contentType: f.mimetype,
      nomFichier: fixFileName(f.originalname),
      taille: f.size,
      expireLe: announcement.expireLe,
    });
    announcement.fichiers.push({ _id: doc._id, nomFichier: doc.nomFichier, contentType: doc.contentType, taille: doc.taille });
  }
  await announcement.save();
}

// POST /api/announcements (administrateur) — message + photos + PDF
exports.createAnnouncement = async (req, res) => {
  try {
    const { titre, contenu, type } = req.body;
    const expireLe = parseExpire(req.body.expireLe);
    const files = req.files || [];

    if (!titre || !String(titre).trim()) return res.status(400).json({ message: 'Merci de renseigner un titre.' });
    if (!String(contenu || '').trim() && !files.length) {
      return res.status(400).json({ message: 'Écris un message ou joins au moins un fichier.' });
    }
    if (type === 'Planning de la semaine' && !expireLe) {
      return res.status(400).json({ message: "Merci de préciser jusqu'à quand ce planning est valable." });
    }

    const announcement = await Announcement.create({
      titre,
      contenu: contenu || '',
      type: type || 'Message',
      auteur: authorName(req.user),
      expireLe,
    });
    await attachFiles(announcement, files);
    res.status(201).json(announcement);

    // Notification sur les téléphones / PC des techniciens (en arrière-plan)
    const texte = String(contenu || '').trim();
    const nbFichiers = files.length;
    notifyTechnicians({
      title: `${announcement.type === 'Planning de la semaine' ? '📅' : announcement.type === 'Annonce importante' ? '⚠️' : '📢'} ${announcement.type} — UNIFOOD`,
      body: `${announcement.titre}${texte ? ` : ${texte.slice(0, 140)}` : ''}${nbFichiers ? ` (${nbFichiers} fichier${nbFichiers > 1 ? 's' : ''} joint${nbFichiers > 1 ? 's' : ''})` : ''}`,
      tag: `annonce-${announcement._id}`,
      url: '/technicien/dashboard.html#annonces',
    }).catch((err) => console.error('Notification annonce :', err.message));
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de la publication de l'annonce.", error: err.message });
  }
};

// GET /api/announcements
exports.getAnnouncements = async (req, res) => {
  try {
    const filters = { $or: [{ expireLe: null }, { expireLe: { $gt: new Date() } }] };
    if (req.user.role === 'technicien') filters.actif = true;
    else if (req.query.actif !== undefined) filters.actif = req.query.actif === 'true';
    const announcements = await Announcement.find(filters).sort({ createdAt: -1 }).limit(200);
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des annonces.', error: err.message });
  }
};

// GET /api/announcements/files/:fileId
exports.downloadFile = async (req, res) => {
  try {
    const file = await AnnouncementFile.findById(req.params.fileId).select('+data');
    if (!file) return res.status(404).json({ message: 'Fichier introuvable.' });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.nomFichier)}`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(file.data);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du téléchargement du fichier.', error: err.message });
  }
};

// PATCH /api/announcements/:id (administrateur) — modifier, archiver/réactiver, ajouter des fichiers
exports.updateAnnouncement = async (req, res) => {
  try {
    const { titre, contenu, type, actif } = req.body;
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'Annonce introuvable.' });

    if (titre !== undefined) announcement.titre = titre;
    if (contenu !== undefined) announcement.contenu = contenu;
    if (type !== undefined) announcement.type = type;
    if (actif !== undefined) announcement.actif = actif === true || actif === 'true';
    if (req.body.expireLe !== undefined) {
      announcement.expireLe = parseExpire(req.body.expireLe);
      await AnnouncementFile.updateMany({ announcement: announcement._id }, { expireLe: announcement.expireLe });
    }
    await announcement.save();
    await attachFiles(announcement, req.files || []);
    res.json(announcement);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour.', error: err.message });
  }
};

// DELETE /api/announcements/:id/files/:fileId (administrateur) — retire un fichier joint
exports.removeFile = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: 'Annonce introuvable.' });
    announcement.fichiers.pull(req.params.fileId);
    await announcement.save();
    await AnnouncementFile.deleteOne({ _id: req.params.fileId, announcement: announcement._id });
    res.json(announcement);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression du fichier.', error: err.message });
  }
};

// DELETE /api/announcements/:id (administrateur)
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id).select('_id');
    if (!announcement) return res.status(404).json({ message: 'Annonce introuvable.' });
    await Announcement.deleteOne({ _id: announcement._id });
    await AnnouncementFile.deleteMany({ announcement: announcement._id });
    res.json({ message: 'Annonce supprimée.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression.', error: err.message });
  }
};

exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
exports.MAX_FILES = MAX_FILES;
exports.ALLOWED_MIMES = ALLOWED_MIMES;
exports._internals = { fixFileName, parseExpire };
