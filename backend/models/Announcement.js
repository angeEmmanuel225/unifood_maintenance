const mongoose = require('mongoose');

const TYPES = ['Planning de la semaine', 'Message', 'Annonce importante'];

const announcementSchema = new mongoose.Schema(
  {
    titre: { type: String, required: true, trim: true },
    contenu: { type: String, required: true, trim: true },
    type: { type: String, enum: TYPES, default: 'Message' },
    auteur: { type: String, required: true, trim: true }, // nom du responsable qui publie
    actif: { type: Boolean, default: true },
    // Optionnel : date/heure à partir de laquelle l'annonce se supprime automatiquement
    // (utilisé notamment pour "Planning de la semaine", qui n'a plus lieu d'être une fois la semaine passée).
    expireLe: { type: Date, default: null },
  },
  { timestamps: true }
);

announcementSchema.index({ actif: 1, createdAt: -1 });
// Index TTL : MongoDB supprime automatiquement le document dès que "expireLe" est dans le passé.
// Les annonces sans expireLe (null) ne sont jamais concernées.
announcementSchema.index({ expireLe: 1 }, { expireAfterSeconds: 0 });

announcementSchema.statics.TYPES = TYPES;

module.exports = mongoose.model('Announcement', announcementSchema);
