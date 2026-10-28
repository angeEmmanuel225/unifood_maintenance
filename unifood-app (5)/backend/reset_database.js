// ============================================================
// REMISE À ZÉRO COMPLÈTE de la base de données.
//
// Supprime : tous les comptes techniciens, tous les rapports, commandes, sorties magasin,
//            annonces, photos, brouillons et anciens départements.
// Conserve : UNIQUEMENT le compte de l'administrateur (par défaut responsable@unifoodtogo.tg).
// Recrée   : les 5 départements et leurs responsables.
//
// Utilisation (dossier backend, avec ton .env qui pointe vers MongoDB Atlas) :
//     node reset_database.js --oui
//
// ⚠️  IRRÉVERSIBLE. Lance d'abord la sauvegarde (cd ../backup && node backup.js) si tu veux garder une copie.
// ============================================================
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Department = require('./models/Department');
const Report = require('./models/Report');
const ReportPhoto = require('./models/ReportPhoto');
const ReportDraft = require('./models/ReportDraft');
const Order = require('./models/Order');
const Withdrawal = require('./models/Withdrawal');
const Announcement = require('./models/Announcement');
const AnnouncementFile = require('./models/AnnouncementFile');
const departments = require('./config/departments');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'responsable@unifoodtogo.tg').toLowerCase();
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'Responsable@2026';

async function run() {
  if (!process.argv.includes('--oui')) {
    console.log('\n⚠️  Cette commande EFFACE toute la base (sauf le compte administrateur).');
    console.log('Pour confirmer, relance :  node reset_database.js --oui\n');
    process.exit(0);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connecté à MongoDB. Remise à zéro en cours...\n');

  // 1) Comptes : on garde seulement l'administrateur
  const del = await User.deleteMany({ email: { $ne: ADMIN_EMAIL } });
  console.log(`- ${del.deletedCount} compte(s) supprimé(s).`);

  const admin = await User.findOne({ email: ADMIN_EMAIL });
  if (!admin) {
    await User.create({
      nom: 'EDJE',
      prenom: 'Jonathan',
      email: ADMIN_EMAIL,
      password: await bcrypt.hash(ADMIN_DEFAULT_PASSWORD, 10),
      role: 'responsable',
      departement: 'Administration',
      matricule: 'ADMIN-001',
    });
    console.log(`- Compte administrateur recréé : ${ADMIN_EMAIL} / ${ADMIN_DEFAULT_PASSWORD}`);
  } else {
    await User.updateOne({ _id: admin._id }, { $set: { role: 'responsable', actif: true } });
    console.log(`- Compte administrateur conservé : ${ADMIN_EMAIL}`);
  }

  // 2) Toutes les autres données
  for (const Model of [Report, ReportPhoto, ReportDraft, Order, Withdrawal, Announcement, AnnouncementFile, Department]) {
    const r = await Model.deleteMany({});
    console.log(`- ${Model.modelName} : ${r.deletedCount} document(s) supprimé(s).`);
  }

  // 3) Anciennes collections de secours éventuelles
  const db = mongoose.connection.db;
  for (const name of ['reports_legacy_backup', 'orders_legacy_backup']) {
    const exists = await db.listCollections({ name }).toArray();
    if (exists.length) {
      await db.dropCollection(name);
      console.log(`- Collection ${name} supprimée.`);
    }
  }

  // 4) Départements + index (dont les suppressions automatiques)
  for (const dep of departments) await Department.create(dep);
  console.log(`- ${departments.length} départements créés.`);
  for (const Model of [User, Report, ReportPhoto, ReportDraft, Order, Withdrawal, Announcement, AnnouncementFile, Department]) {
    try {
      await Model.syncIndexes();
    } catch (e) {
      /* index recréés au prochain démarrage du serveur */
    }
  }

  console.log('\n✅ Base remise à zéro. Il ne reste que le compte administrateur :');
  console.log(`   identifiant : ${ADMIN_EMAIL}`);
  console.log("   (son mot de passe n'a pas été modifié)");
  console.log('\nConnecte-toi sur l\'Espace Administrateur → onglet « Comptes » pour créer les techniciens.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Erreur :', err.message || err);
  process.exit(1);
});
