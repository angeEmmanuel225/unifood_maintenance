const mongoose = require('mongoose');

const announcementFileSchema = new mongoose.Schema({
  announcement: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true, index: true },
  data: { type: Buffer, required: true, select: false },
  contentType: { type: String, required: true },
  nomFichier: { type: String, default: 'fichier' },
  taille: { type: Number, default: 0 },
  // Même date d'expiration que l'annonce : les fichiers disparaissent avec elle.
  expireLe: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

announcementFileSchema.index({ expireLe: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AnnouncementFile', announcementFileSchema);
