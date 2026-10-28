const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, trim: true },
    prenom: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['technicien', 'responsable'],
      required: true,
      default: 'technicien',
    },
    departement: { type: String, trim: true },
    telephone: { type: String, trim: true },
    matricule: { type: String, trim: true },
    actif: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    nom: this.nom,
    prenom: this.prenom,
    email: this.email,
    role: this.role,
    departement: this.departement,
    telephone: this.telephone,
    matricule: this.matricule,
  };
};

module.exports = mongoose.model('User', userSchema);
