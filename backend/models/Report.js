const mongoose = require('mongoose');

const HORAIRES = ['06h-14h', '14h-22h', '22h-06h', 'Journée 08h-16h'];
const STATUTS_PANNE = ['Résolue', 'En cours', 'Non résolue'];
const STATUTS_RAPPORT = ['Nouveau', 'Lu', 'Traité'];

const reportSchema = new mongoose.Schema(
  {
    technicien: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    technicienNom: { type: String, required: true },
    departement: { type: String, required: true, trim: true },
    responsableDepartement: { type: String, required: true, trim: true },
    horaire: { type: String, enum: HORAIRES, required: true },
    dateRapport: { type: Date, required: true },
    machineConcernee: { type: String, required: true, trim: true },
    descriptionPanne: { type: String, required: true, trim: true },
    actionMenee: { type: String, required: true, trim: true },
    heureDebut: { type: String, required: true },
    heureFin: { type: String, required: true },
    statutPanne: {
      type: String,
      enum: STATUTS_PANNE,
      default: 'Résolue',
    },
    observations: { type: String, trim: true },
    statutRapport: {
      type: String,
      enum: STATUTS_RAPPORT,
      default: 'Nouveau',
    },
  },
  { timestamps: true }
);

reportSchema.index({ dateRapport: -1 });
reportSchema.index({ departement: 1 });
reportSchema.index({ technicien: 1 });

reportSchema.statics.HORAIRES = HORAIRES;
reportSchema.statics.STATUTS_PANNE = STATUTS_PANNE;
reportSchema.statics.STATUTS_RAPPORT = STATUTS_RAPPORT;

module.exports = mongoose.model('Report', reportSchema);
