require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Change le mot de passe ci-dessous si tu veux en choisir un autre.
const EMAIL = 'bigouaangeemmanuelta@gmail.com';
const NOUVEAU_MOT_DE_PASSE = 'Emmanuel@2026';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connecté à MongoDB...');

  const hashed = await bcrypt.hash(NOUVEAU_MOT_DE_PASSE, 10);

  const result = await User.updateOne(
    { email: EMAIL },
    { $set: { password: hashed, departement: 'Mécaniciens du Four', actif: true } }
  );

  if (result.matchedCount === 0) {
    console.log(`Aucun compte trouvé avec l'email ${EMAIL}.`);
  } else {
    console.log(`Mot de passe réinitialisé pour ${EMAIL}.`);
    console.log(`Nouveau mot de passe : ${NOUVEAU_MOT_DE_PASSE}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Erreur :', err);
  process.exit(1);
});
