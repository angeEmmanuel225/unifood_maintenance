require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Department = require('./models/Department');
const User = require('./models/User');

const departments = [
  { nom: 'Four (Cuisson)', responsable: 'M. AMOUZOU Kodjo', description: 'Cuisson de la pâte de bonbon, régulation température/pression des fours.' },
  { nom: 'Mélange & Malaxage', responsable: 'Mme DJATO Akouvi', description: 'Préparation et dosage des ingrédients.' },
  { nom: 'Moulage & Formage', responsable: 'M. TCHASSA Komi', description: 'Mise en forme des bonbons (moulage, découpe, calibrage).' },
  { nom: 'Conditionnement & Emballage', responsable: 'Mme BALOUKI Essi', description: 'Emballage, mise en sachet et cartonnage.' },
  { nom: 'Utilités (Froid, Air comprimé, Chaudière)', responsable: 'M. KUMASSAH Yawo', description: 'Groupes froid, compresseurs, chaudière et réseaux d\u2019énergie.' },
  { nom: 'Électricité & Automatisme', responsable: 'M. AGBOKA Sena', description: 'Armoires électriques, automates et instrumentation.' },
  { nom: 'Qualité & Hygiène', responsable: 'Mme SEDDOH Ama', description: 'Contrôle qualité, hygiène et sécurité alimentaire.' },
];

const demoUsers = [
  {
    nom: 'TA BI GOUA',
    prenom: 'Ange Emmanuel',
    email: 'bigouaangeemmanuelta@gmail.com',
    password: 'Emmanuel@2026',
    role: 'technicien',
    departement: 'Four (Cuisson)',
    matricule: 'TECH-001',
  },
  {
    nom: 'MENSAH',
    prenom: 'Kossi',
    email: 'kossi.mensah@unifoodtogo.tg',
    password: 'Technicien@2026',
    role: 'technicien',
    departement: 'Conditionnement & Emballage',
    matricule: 'TECH-002',
  },
  {
    nom: 'KUMA',
    prenom: 'Afi',
    email: 'afi.kuma@unifoodtogo.tg',
    password: 'Technicien@2026',
    role: 'technicien',
    departement: 'Utilités (Froid, Air comprimé, Chaudière)',
    matricule: 'TECH-003',
  },
  {
    nom: 'AKAKPO',
    prenom: 'Comlan',
    email: 'responsable@unifoodtogo.tg',
    password: 'Responsable@2026',
    role: 'responsable',
    departement: 'Maintenance Générale',
    matricule: 'RESP-001',
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connecté à MongoDB pour le seed...');

  for (const dep of departments) {
    await Department.findOneAndUpdate({ nom: dep.nom }, dep, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  console.log(`${departments.length} départements initialisés.`);

  for (const u of demoUsers) {
    const exists = await User.findOne({ email: u.email.toLowerCase() });
    if (exists) {
      console.log(`- Compte déjà existant : ${u.email}`);
      continue;
    }
    const hashed = await bcrypt.hash(u.password, 10);
    await User.create({ ...u, email: u.email.toLowerCase(), password: hashed });
    console.log(`- Compte créé : ${u.email} (${u.role}) / mot de passe initial : ${u.password}`);
  }

  console.log('\nSeed terminé. Pense à changer les mots de passe par défaut !');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Erreur durant le seed :', err);
  process.exit(1);
});
