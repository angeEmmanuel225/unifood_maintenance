require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Modifie cette ligne si tu veux un mot de passe différent
const EMAIL = 'responsable@unifoodtogo.tg';
const NOUVEAU_MOT_DE_PASSE = 'Responsable@2026';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connecté à MongoDB...');

  const hashed = await bcrypt.hash(NOUVEAU_MOT_DE_PASSE, 10);

  // "upsert: true" = met à jour le compte s'il existe déjà,
  // ou le recrée entièrement s'il a disparu.
  const result = await User.findOneAndUpdate(
    { email: EMAIL },
    {
      $set: {
        password: hashed,
        nom: 'EDJE',
        prenom: 'Jonathan',
        role: 'responsable',
        departement: 'Maintenance Générale',
        matricule: 'RESP-001',
        actif: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`\nCompte responsable prêt : ${result.email}`);
  console.log(`Mot de passe : ${NOUVEAU_MOT_DE_PASSE}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Erreur :', err);
  process.exit(1);
});
