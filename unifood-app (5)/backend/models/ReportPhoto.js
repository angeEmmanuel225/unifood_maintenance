const mongoose = require('mongoose');

// Photos de rapports papier : compressées sur le téléphone avant l'envoi (~100 Ko),
// puis supprimées automatiquement après RETENTION_DAYS jours pour ne pas remplir la base.
const RETENTION_DAYS = 30;

const reportPhotoSchema = new mongoose.Schema({
  report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true, index: true },
  technicien: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  data: { type: Buffer, required: true, select: false },
  contentType: { type: String, default: 'image/jpeg' },
  taille: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

reportPhotoSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 3600 });
reportPhotoSchema.statics.RETENTION_DAYS = RETENTION_DAYS;

module.exports = mongoose.model('ReportPhoto', reportPhotoSchema);
