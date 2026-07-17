const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, unique: true, trim: true },
    responsable: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Department', departmentSchema);
