// Initialise la base : les 5 départements (avec leur responsable) + le compte administrateur.
// Ne crée AUCUN technicien : c'est l'administrateur qui les crée depuis son espace (onglet « Comptes »).
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Department = require('./models/Department');
const User = require('./models/User');
const departments = require('./config/departments');

const ADMIN = {
  nom: 'EDJE',
  prenom: 'Jonathan',
  email: (process.env.ADMIN_EMAIL || 'responsable@unifoodtogo.tg').toLowerCase(),
  password: process.env.ADMIN_PASSWORD || 'Responsable@2026',
  role: 'responsable',
  departement: 'Administration',
  matricule: 'ADMIN-001',
};

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connecté à MongoDB...');
  for (const dep of departments) {
    await Department.updateOne({ nom: dep.nom }, { $set: dep }, { upsert: true });
  }
  console.log(`${departments.length} départements initialisés.`);
  const exists = await User.findOne({ email: ADMIN.email });
  if (exists) {
    console.log(`Compte administrateur déjà présent : ${ADMIN.email}`);
  } else {
    await User.create({ ...ADMIN, password: await bcrypt.hash(ADMIN.password, 10) });
    console.log(`Compte administrateur créé : ${ADMIN.email} / mot de passe : ${ADMIN.password}`);
  }
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Erreur durant le seed :', err);
  process.exit(1);
});
