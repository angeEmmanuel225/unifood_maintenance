const mongoose = require('mongoose');

const STATUTS = ['Nouveau', 'Vu'];

const withdrawalItemSchema = new mongoose.Schema({
  designation: { type: String, required: true, trim: true },
  reference: { type: String, default: '', trim: true },
  quantite: { type: Number, required: true, min: 1 },
  unite: { type: String, default: 'pièce', trim: true },
  machine: { type: String, default: '', trim: true }, // machine / destination de la pièce
});

// Un "bon de sortie magasin" : pièces prises au magasin par un technicien.
const withdrawalSchema = new mongoose.Schema(
  {
    technicien: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    technicienNom: { type: String, required: true },
    departement: { type: String, default: '', trim: true },
    items: { type: [withdrawalItemSchema], default: [] },
    note: { type: String, default: '', trim: true },
    statut: { type: String, enum: STATUTS, default: 'Nouveau' },
    vuPar: { type: String, default: '' },
    vuLe: { type: Date, default: null },
  },
  { timestamps: true }
);

withdrawalSchema.index({ createdAt: -1 });
withdrawalSchema.index({ technicien: 1, createdAt: -1 });
withdrawalSchema.index({ statut: 1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
