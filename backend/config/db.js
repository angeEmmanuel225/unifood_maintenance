const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('MONGO_URI manquant dans le fichier .env');
    process.exit(1);
  }

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connecté :', mongoose.connection.name);
  });

  mongoose.connection.on('error', (err) => {
    console.error('Erreur de connexion MongoDB :', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB déconnecté. Nouvelle tentative dans 5s...');
    setTimeout(connectDB, 5000);
  });

  try {
    await mongoose.connect(uri);
  } catch (err) {
    console.error('Impossible de se connecter à MongoDB :', err.message);
    console.error('Vérifie ta variable MONGO_URI dans le fichier .env');
    setTimeout(connectDB, 5000);
  }
}

module.exports = connectDB;
