// ============================================================
// Migration : passe des anciens rapports/commandes "un par panne"
// / "un par article" au nouveau format "une fiche par jour et par
// technicien, avec plusieurs entrées/articles dedans".
//
// SÉCURITÉ : les anciennes collections sont renommées en
// "reports_legacy_backup" / "orders_legacy_backup" (jamais supprimées).
// Si quelque chose se passe mal, tes données originales restent intactes.
//
// À lancer UNE SEULE FOIS, après avoir mis à jour le code du backend,
// idéalement juste après une sauvegarde (node ../backup/backup.js).
// ============================================================
require('dotenv').config();
const mongoose = require('mongoose');

function toDayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date) {
  return toDayStart(date).toISOString();
}

async function migrateReports(db) {
  const collections = await db.listCollections({ name: 'reports' }).toArray();
  if (!collections.length) {
    console.log('Aucune collection "reports" existante — rien à migrer.');
    return;
  }

  const oldDocs = await db.collection('reports').find({}).toArray();
  console.log(`\n${oldDocs.length} ancien(s) rapport(s) trouvé(s).`);

  // Si les documents ont déjà un champ "entries", la migration a déjà été faite.
  if (oldDocs.length && oldDocs[0].entries) {
    console.log('Les rapports semblent déjà au nouveau format (champ "entries" présent). Migration ignorée.');
    return;
  }

  await db.collection('reports').rename('reports_legacy_backup');
  console.log('Ancienne collection renommée en "reports_legacy_backup" (conservée intacte).');

  const groups = new Map();
  for (const doc of oldDocs) {
    const key = `${doc.technicien}_${dayKey(doc.dateRapport)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        technicien: doc.technicien,
        technicienNom: doc.technicienNom,
        departement: doc.departement,
        responsableDepartement: doc.responsableDepartement,
        horaire: doc.horaire,
        dateRapport: toDayStart(doc.dateRapport),
        entries: [],
        statutRapport: doc.statutRapport || 'Nouveau',
        exporte: false,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      });
    }
    const group = groups.get(key);
    group.entries.push({
      machineConcernee: doc.machineConcernee,
      descriptionPanne: doc.descriptionPanne,
      actionMenee: doc.actionMenee,
      heureDebut: doc.heureDebut,
      heureFin: doc.heureFin,
      statutPanne: doc.statutPanne || 'Résolue',
      observations: doc.observations || '',
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    });
    // La fiche prend le statut le plus avancé rencontré parmi le groupe
    const order = { Nouveau: 0, Lu: 1, Traité: 2 };
    if ((order[doc.statutRapport] || 0) > (order[group.statutRapport] || 0)) {
      group.statutRapport = doc.statutRapport;
    }
  }

  const newDocs = Array.from(groups.values());
  if (newDocs.length) {
    await db.collection('reports').insertMany(newDocs);
  }
  console.log(`${newDocs.length} fiche(s) regroupée(s) créée(s) dans "reports" (à partir de ${oldDocs.length} ancien(s) document(s)).`);
}

async function migrateOrders(db) {
  const collections = await db.listCollections({ name: 'orders' }).toArray();
  if (!collections.length) {
    console.log('Aucune collection "orders" existante — rien à migrer.');
    return;
  }

  const oldDocs = await db.collection('orders').find({}).toArray();
  console.log(`\n${oldDocs.length} ancienne(s) commande(s) trouvée(s).`);

  if (oldDocs.length && oldDocs[0].items) {
    console.log('Les commandes semblent déjà au nouveau format (champ "items" présent). Migration ignorée.');
    return;
  }

  await db.collection('orders').rename('orders_legacy_backup');
  console.log('Ancienne collection renommée en "orders_legacy_backup" (conservée intacte).');

  const groups = new Map();
  for (const doc of oldDocs) {
    const dateRef = doc.createdAt || new Date();
    const key = `${doc.technicien}_${dayKey(dateRef)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        technicien: doc.technicien,
        technicienNom: doc.technicienNom,
        departement: doc.departement,
        dateCommande: toDayStart(dateRef),
        items: [],
        exporte: false,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      });
    }
    groups.get(key).items.push({
      designation: doc.designation,
      reference: doc.reference || '',
      quantite: doc.quantite,
      unite: doc.unite || 'pièce',
      urgence: doc.urgence || 'Normale',
      motif: doc.motif,
      dateSouhaitee: doc.dateSouhaitee,
      statutCommande: doc.statutCommande || 'En attente',
      noteResponsable: doc.noteResponsable || '',
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    });
  }

  const newDocs = Array.from(groups.values());
  if (newDocs.length) {
    await db.collection('orders').insertMany(newDocs);
  }
  console.log(`${newDocs.length} fiche(s) commande regroupée(s) créée(s) dans "orders" (à partir de ${oldDocs.length} ancien(s) document(s)).`);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Connecté à MongoDB. Début de la migration...');

  await migrateReports(db);
  await migrateOrders(db);

  console.log('\nMigration terminée. Les anciennes données sont conservées dans');
  console.log('"reports_legacy_backup" et "orders_legacy_backup" si besoin de vérifier.');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Erreur pendant la migration :', err);
  process.exit(1);
});
