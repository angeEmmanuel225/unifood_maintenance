const mongoose = require('mongoose');

// Petits réglages internes de l'application (ex. clés des notifications)
const settingSchema = new mongoose.Schema({
  cle: { type: String, required: true, unique: true },
  valeur: { type: String, default: '' },
});

module.exports = mongoose.model('Setting', settingSchema);
