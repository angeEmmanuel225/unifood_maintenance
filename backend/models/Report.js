const mongoose = require('mongoose');

const HORAIRES = ['06h-14h', '14h-22h', '22h-06h', 'Journée 08h-16h'];
const STATUTS_PANNE = ['Résolue', 'En cours', 'Non résolue'];
const STATUTS_RAPPORT = ['Nouveau', 'Lu', 'Traité'];

// Une ligne du grand tableau de la fiche
const reportEntrySchema = new mongoose.Schema(
  {
    machineConcernee: { type: String, required: true, trim: true },
    descriptionPanne: { type: String, required: true, trim: true }, // "Panne ou observations"
    actionMenee: { type: String, default: '', trim: true }, // "Tâche effectuée"
    heureDebut: { type: String, default: '' },
    heureFin: { type: String, default: '' },
    statutPanne: { type: String, enum: STATUTS_PANNE, default: 'Résolue' },
  },
  { timestamps: true }
);

// Une fiche = tout ce qu'un technicien déclare pour une même date.
const reportSchema = new mongoose.Schema(
  {
    technicien: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    technicienNom: { type: String, required: true },
    departement: { type: String, required: true, trim: true },
    responsableDepartement: { type: String, required: true, trim: true },
    horaire: { type: String, enum: HORAIRES, required: true },
    dateRapport: { type: Date, required: true }, // normalisé à minuit
    entries: { type: [reportEntrySchema], default: [] },
    // Signature dessinée (petit PNG en base64) — exclue des listes pour rester léger
    signature: { type: String, default: '', select: false },
    nbPhotos: { type: Number, default: 0 },
    statutRapport: { type: String, enum: STATUTS_RAPPORT, default: 'Nouveau' },
    exporte: { type: Boolean, default: false },
  },
  { timestamps: true }
);

reportSchema.index({ technicien: 1, dateRapport: 1 }, { unique: true });
reportSchema.index({ departement: 1 });

reportSchema.statics.HORAIRES = HORAIRES;
reportSchema.statics.STATUTS_RAPPORT = STATUTS_RAPPORT;

module.exports = mongoose.model('Report', reportSchema);
