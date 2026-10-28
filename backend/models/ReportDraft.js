const mongoose = require('mongoose');

// Brouillon de la fiche en cours de rédaction (sauvegarde automatique côté serveur).
// Un seul brouillon par technicien ; supprimé automatiquement après 14 jours sans modification.
const reportDraftSchema = new mongoose.Schema({
  technicien: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  payload: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
});

reportDraftSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 14 * 24 * 3600 });

module.exports = mongoose.model('ReportDraft', reportDraftSchema);
