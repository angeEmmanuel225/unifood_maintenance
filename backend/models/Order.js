const mongoose = require('mongoose');

const URGENCES = ['Normale', 'Urgente', 'Critique'];
const STATUTS_COMMANDE = ['En attente', 'Validée', 'Rejetée', 'Livrée'];

const orderSchema = new mongoose.Schema(
  {
    technicien: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    technicienNom: { type: String, required: true },
    departement: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    reference: { type: String, trim: true },
    quantite: { type: Number, required: true, min: 1 },
    unite: { type: String, default: 'pièce', trim: true },
    urgence: { type: String, enum: URGENCES, default: 'Normale' },
    motif: { type: String, required: true, trim: true },
    dateSouhaitee: { type: Date },
    statutCommande: {
      type: String,
      enum: STATUTS_COMMANDE,
      default: 'En attente',
    },
    noteResponsable: { type: String, trim: true },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ departement: 1 });
orderSchema.index({ technicien: 1 });

orderSchema.statics.URGENCES = URGENCES;
orderSchema.statics.STATUTS_COMMANDE = STATUTS_COMMANDE;

module.exports = mongoose.model('Order', orderSchema);
