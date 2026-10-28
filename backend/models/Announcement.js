const mongoose = require('mongoose');

const TYPES = ['Planning de la semaine', 'Message', 'Annonce importante'];

// Métadonnées des fichiers joints (le contenu binaire est dans la collection AnnouncementFile)
const attachmentSchema = new mongoose.Schema({
  nomFichier: { type: String, default: '' },
  contentType: { type: String, default: '' },
  taille: { type: Number, default: 0 },
});

const announcementSchema = new mongoose.Schema(
  {
    titre: { type: String, required: true, trim: true },
    contenu: { type: String, default: '', trim: true },
    type: { type: String, enum: TYPES, default: 'Message' },
    auteur: { type: String, required: true, trim: true },
    actif: { type: Boolean, default: true },
    // Date de fin de validité : l'annonce (et ses fichiers) se supprime automatiquement après.
    expireLe: { type: Date, default: null },
    fichiers: { type: [attachmentSchema], default: [] },
  },
  { timestamps: true }
);

announcementSchema.index({ actif: 1, createdAt: -1 });
announcementSchema.index({ expireLe: 1 }, { expireAfterSeconds: 0 });

announcementSchema.statics.TYPES = TYPES;

module.exports = mongoose.model('Announcement', announcementSchema);
