const fs = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');
const { MongoClient } = require('mongodb');
const { google } = require('googleapis');

const MONGO_URI = process.env.MONGO_URI;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const FOLDER_ID = process.env.GDRIVE_FOLDER_ID;
const RETENTION_DAYS = 30;

function required(name, value) {
  if (!value) {
    console.error(`Variable manquante : ${name}`);
    process.exit(1);
  }
}

async function dumpDatabase() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(); // utilise la base indiquée dans MONGO_URI (après le dernier "/")
  const collections = await db.listCollections().toArray();

  const dump = {};
  for (const { name } of collections) {
    dump[name] = await db.collection(name).find({}).toArray();
  }

  await client.close();
  return dump;
}

function createZip(dump, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    for (const [name, docs] of Object.entries(dump)) {
      archive.append(JSON.stringify(docs, null, 2), { name: `${name}.json` });
    }

    archive.finalize();
  });
}

function getDriveClient() {
  const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: oAuth2Client });
}

async function uploadToDrive(drive, filePath, fileName) {
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [FOLDER_ID] },
    media: { mimeType: 'application/zip', body: fs.createReadStream(filePath) },
    fields: 'id, name',
  });
  return res.data;
}

async function cleanOldBackups(drive) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and trashed = false`,
    fields: 'files(id, name, createdTime)',
    orderBy: 'createdTime',
  });

  const old = (res.data.files || []).filter((f) => new Date(f.createdTime) < cutoff);
  for (const f of old) {
    await drive.files.delete({ fileId: f.id });
    console.log(`Ancienne sauvegarde supprimée : ${f.name}`);
  }
}

async function run() {
  required('MONGO_URI', MONGO_URI);
  required('GOOGLE_CLIENT_ID', CLIENT_ID);
  required('GOOGLE_CLIENT_SECRET', CLIENT_SECRET);
  required('GOOGLE_REFRESH_TOKEN', REFRESH_TOKEN);
  required('GDRIVE_FOLDER_ID', FOLDER_ID);

  console.log('Connexion à MongoDB et export des données...');
  const dump = await dumpDatabase();
  const totalDocs = Object.values(dump).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`${Object.keys(dump).length} collections exportées (${totalDocs} documents au total).`);

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `unifood-backup-${dateStr}.zip`;
  const zipPath = path.join(os.tmpdir(), fileName);

  console.log('Compression...');
  await createZip(dump, zipPath);

  console.log('Connexion à Google Drive...');
  const drive = getDriveClient();

  console.log('Envoi vers Google Drive...');
  const uploaded = await uploadToDrive(drive, zipPath, fileName);
  console.log(`Sauvegarde envoyée : ${uploaded.name} (id: ${uploaded.id})`);

  console.log(`Nettoyage des sauvegardes de plus de ${RETENTION_DAYS} jours...`);
  await cleanOldBackups(drive);

  fs.unlinkSync(zipPath);
  console.log('Terminé.');
}

run().catch((err) => {
  console.error('Erreur pendant la sauvegarde :', err);
  process.exit(1);
});
