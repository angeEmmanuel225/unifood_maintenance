require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const User = require('./models/User');
const Department = require('./models/Department');

// ============================================================
// 1) ÉQUIPES TECHNIQUES RÉELLES (d'après le planning hebdomadaire)
//    Corrige "responsable" si tu connais le nom exact du responsable
//    de chaque équipe (actuellement, tous pointent vers le signataire
//    générique "Responsable Technique" du document).
// ============================================================
const departments = [
  { nom: 'Électriciens', responsable: 'Responsable Technique' },
  { nom: "Mécaniciens d'Emballage", responsable: 'Responsable Technique' },
  { nom: 'Section Mayonnaise', responsable: 'Responsable Technique' },
  { nom: 'Frigoristes, Plombiers & Chaudière', responsable: 'Responsable Technique' },
  { nom: 'Tournage', responsable: 'Responsable Technique' },
  { nom: 'Mécaniciens du Four', responsable: 'Responsable Technique' },
  { nom: 'Soudeurs & Peintres', responsable: 'Responsable Technique' },
];

// ============================================================
// 2) LISTE DES TECHNICIENS À CRÉER
//    ⚠️ Relis chaque ligne en comparant au planning original avant de lancer
//    ce script : une erreur de lecture ici = un identifiant erroné pour une
//    vraie personne. Corrige directement dans ce tableau si besoin.
//    "(à préciser)" = seul un nom était lisible sur le document.
// ============================================================
const technicians = [
  // --- Électriciens ---
  { nom: 'DOKE', prenom: 'Martinien', departement: 'Électriciens' },
  { nom: 'HUISSO', prenom: 'Wilfried', departement: 'Électriciens' },
  { nom: 'SETOGLO', prenom: 'Kodjo', departement: 'Électriciens' },
  { nom: 'EMMANUEL', prenom: '(à préciser)', departement: 'Électriciens' },
  { nom: 'FOLLY', prenom: 'Y. Edho', departement: 'Électriciens' },
  { nom: 'SONI', prenom: 'Brice', departement: 'Électriciens' },
  { nom: 'MODESTE', prenom: '(à préciser)', departement: 'Électriciens' },
  { nom: 'HOUNDETON', prenom: 'Yao A.', departement: 'Électriciens' },
  { nom: 'HAIDARA', prenom: 'M. Aguib', departement: 'Électriciens' },
  { nom: 'TASSIGUE', prenom: 'Akossiwa', departement: 'Électriciens' },
  { nom: 'AMEDODJI', prenom: 'Mensah', departement: 'Électriciens' },

  // --- Mécaniciens d'Emballage ---
  { nom: 'APETSI', prenom: 'Alexis', departement: "Mécaniciens d'Emballage" },
  { nom: 'KPADENOU', prenom: 'Philippe', departement: "Mécaniciens d'Emballage" },
  { nom: 'KONDO-M.', prenom: 'Kossivi', departement: "Mécaniciens d'Emballage" },
  { nom: 'AHLEMEGNI', prenom: 'K. Jean', departement: "Mécaniciens d'Emballage" },
  { nom: 'HILY', prenom: 'Kinapary', departement: "Mécaniciens d'Emballage" },
  { nom: 'GAWU', prenom: 'Koffi G.', departement: "Mécaniciens d'Emballage" },
  { nom: 'KOUASSI', prenom: 'Cyriaque', departement: "Mécaniciens d'Emballage" },
  { nom: 'KOUASSI', prenom: 'Sossa', departement: "Mécaniciens d'Emballage" },
  { nom: 'MOUHAMAN', prenom: '(à préciser)', departement: "Mécaniciens d'Emballage" },
  { nom: 'DONALD', prenom: '(à préciser)', departement: "Mécaniciens d'Emballage" },
  { nom: 'ABOTCHI', prenom: 'Atsou', departement: "Mécaniciens d'Emballage" },
  { nom: 'GUNN', prenom: 'Daniel', departement: "Mécaniciens d'Emballage" },
  { nom: 'OLADOKOUN', prenom: 'Michel', departement: "Mécaniciens d'Emballage" },
  { nom: 'LANDRINE', prenom: '(à préciser)', departement: "Mécaniciens d'Emballage" },
  { nom: 'TOFFA', prenom: 'E. Laurent', departement: "Mécaniciens d'Emballage" },
  { nom: 'EGLON', prenom: 'Amavi Eric', departement: "Mécaniciens d'Emballage" },

  // --- Section Mayonnaise ---
  { nom: 'ADAMAN', prenom: 'Ouattara', departement: 'Section Mayonnaise' },

  // --- Frigoristes, Plombiers & Chaudière ---
  { nom: 'VENTURA', prenom: '(à préciser)', departement: 'Frigoristes, Plombiers & Chaudière' },
  { nom: 'SENA', prenom: 'Kokou', departement: 'Frigoristes, Plombiers & Chaudière' },
  { nom: 'ADJIGNON', prenom: 'Koffi', departement: 'Frigoristes, Plombiers & Chaudière' },
  { nom: 'EDJE', prenom: 'Jonathan', departement: 'Frigoristes, Plombiers & Chaudière' },
  { nom: 'AKUE', prenom: 'Daniel', departement: 'Frigoristes, Plombiers & Chaudière' },
  { nom: 'AKOMADO', prenom: 'Sylvain', departement: 'Frigoristes, Plombiers & Chaudière' },
  { nom: 'MESSAN', prenom: 'Folly Dovené', departement: 'Frigoristes, Plombiers & Chaudière' },
  { nom: 'SYLVIO', prenom: '(à préciser)', departement: 'Frigoristes, Plombiers & Chaudière' },
  { nom: 'GAOUSSOU', prenom: 'Abdoulaye', departement: 'Frigoristes, Plombiers & Chaudière' },

  // --- Tournage ---
  { nom: 'KOULALODJI', prenom: 'Komivi', departement: 'Tournage' },
  { nom: 'MENSAH', prenom: 'Folly Alex', departement: 'Tournage' },

  // --- Mécaniciens du Four (Ange TA BI GOUA a déjà un compte, volontairement absent d'ici) ---
  { nom: 'ATTISSO', prenom: 'Koffi Jean', departement: 'Mécaniciens du Four' },
  { nom: 'JEAN CLAUDE', prenom: '(à préciser)', departement: 'Mécaniciens du Four' },
  { nom: 'WINIGA', prenom: 'D.', departement: 'Mécaniciens du Four' },
  { nom: 'AFANOU', prenom: 'Komi Nestor', departement: 'Mécaniciens du Four' },
  { nom: 'AGNADARE', prenom: 'Ahmed', departement: 'Mécaniciens du Four' },
  { nom: 'KOUEVIDJIN', prenom: 'Anoumou', departement: 'Mécaniciens du Four' },
  { nom: 'AMEGANVI', prenom: 'Messan', departement: 'Mécaniciens du Four' },
  { nom: 'AGBO', prenom: 'Loki', departement: 'Mécaniciens du Four' },
  { nom: 'VALERIE', prenom: '(à préciser)', departement: 'Mécaniciens du Four' },
  { nom: 'VENUS', prenom: '(à préciser)', departement: 'Mécaniciens du Four' },
  { nom: 'AGBENOHEVI', prenom: 'Dieudonné', departement: 'Mécaniciens du Four' },
  { nom: 'ADABADJI', prenom: 'Bruce', departement: 'Mécaniciens du Four' },
  { nom: 'KETOWOU', prenom: 'Ulrich', departement: 'Mécaniciens du Four' },
  { nom: 'OUATTARA', prenom: 'Idrissa', departement: 'Mécaniciens du Four' },

  // --- Soudeurs & Peintres ---
  { nom: 'DOH KOKOU', prenom: 'Gagnon', departement: 'Soudeurs & Peintres' },
  { nom: 'AGBETROBU', prenom: 'Elom', departement: 'Soudeurs & Peintres' },
  { nom: 'AHOSSOUDE', prenom: 'Nestor', departement: 'Soudeurs & Peintres' },
  { nom: 'AGBEMAPLE', prenom: 'Raphael', departement: 'Soudeurs & Peintres' },
  { nom: 'DIGNY', prenom: 'Tenoukpo', departement: 'Soudeurs & Peintres' },
  { nom: 'DJRAMEDO', prenom: 'Papa', departement: 'Soudeurs & Peintres' },
  { nom: 'EKUE', prenom: 'Folly', departement: 'Soudeurs & Peintres' },
  { nom: 'KONDO', prenom: 'Nassirou', departement: 'Soudeurs & Peintres' },
];

// ============================================================
// Génération d'un mot de passe aléatoire lisible
// (exclut 0/O/1/l/I pour éviter les confusions à la lecture)
// ============================================================
function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < length; i++) pwd += chars[crypto.randomInt(0, chars.length)];
  return pwd;
}

function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // enlève les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connecté à MongoDB...\n');

  // 1) Créer/mettre à jour les équipes techniques réelles
  for (const dep of departments) {
    await Department.findOneAndUpdate({ nom: dep.nom }, dep, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  console.log(`${departments.length} équipes techniques créées/mises à jour.`);

  // 2) Aligner le compte existant d'Ange sur sa vraie équipe
  const ange = await User.findOne({ email: 'bigouaangeemmanuelta@gmail.com' });
  if (ange && ange.departement !== 'Mécaniciens du Four') {
    ange.departement = 'Mécaniciens du Four';
    await ange.save();
    console.log("Compte d'Ange TA BI GOUA aligné sur l'équipe 'Mécaniciens du Four'.");
  }
  console.log('');

  // 3) Créer les comptes techniciens manquants
  const existingUsers = await User.find({}, 'email');
  const usedEmails = new Set(existingUsers.map((u) => u.email));
  let matriculeCounter = (await User.countDocuments({ role: 'technicien' })) + 1;
  const results = [];

  for (const t of technicians) {
    const nomSlug = slugify(t.nom);
    const prenomSlug = slugify(t.prenom);
    const hasRealPrenom = prenomSlug && !t.prenom.includes('préciser');

    let baseEmail = hasRealPrenom ? `${prenomSlug}.${nomSlug}@unifoodtogo.tg` : `${nomSlug}@unifoodtogo.tg`;
    let email = baseEmail;
    let suffix = 2;
    while (usedEmails.has(email)) {
      email = baseEmail.replace('@', `${suffix}@`);
      suffix++;
    }

    const password = generatePassword();
    const hashed = await bcrypt.hash(password, 10);
    const matricule = `TECH-${String(matriculeCounter).padStart(3, '0')}`;

    await User.create({
      nom: t.nom,
      prenom: t.prenom,
      email,
      password: hashed,
      role: 'technicien',
      departement: t.departement,
      matricule,
    });

    usedEmails.add(email);
    matriculeCounter++;
    results.push({ ...t, email, password, matricule });
    console.log(`- Créé : ${email}  (${t.departement})`);
  }

  // 4) Écrire les identifiants dans un fichier LOCAL (jamais sur GitHub, voir .gitignore)
  const outPath = path.join(__dirname, 'identifiants_generes.csv');
  const header = 'Nom,Prenom,Departement,Matricule,Email,MotDePasse\n';
  const rows = results
    .map((r) => `"${r.nom}","${r.prenom}","${r.departement}","${r.matricule}","${r.email}","${r.password}"`)
    .join('\n');
  fs.writeFileSync(outPath, header + rows, 'utf8');

  console.log(`\n${results.length} nouveaux comptes créés sur ${technicians.length} demandés.`);
  console.log(`Identifiants écrits dans : ${outPath}`);
  console.log('⚠️  Distribue ce fichier en privé à chaque technicien puis SUPPRIME-le. Ne le mets jamais sur GitHub.');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Erreur :', err);
  process.exit(1);
});
