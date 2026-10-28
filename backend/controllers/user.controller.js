const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Department = require('../models/Department');

function slugify(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

// Mot de passe lisible (sans 0/O/1/l/I qui se confondent à l'écriture)
function generatePassword(length = 8) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < length; i++) pwd += chars[crypto.randomInt(0, chars.length)];
  return pwd;
}

async function uniqueIdentifier(prenom, nom) {
  const base = [slugify(prenom), slugify(nom)].filter(Boolean).join('.') || 'technicien';
  let id = base;
  let n = 2;
  while (await User.exists({ email: id })) {
    id = `${base}${n}`;
    n += 1;
  }
  return id;
}

// Découpe "NOM Prénom" (le NOM écrit en majuscules, comme sur les plannings) ; "(n)", "(S)" ignorés
function parseLine(rawLine) {
  const line = String(rawLine || '').replace(/\([^)]*\)/g, '').trim();
  if (!line) return null;
  if (line.includes(',')) {
    const [a, ...rest] = line.split(',');
    return { nom: a.trim(), prenom: rest.join(' ').trim() || '-' };
  }
  const tokens = line.split(/\s+/);
  const isUpper = (t) => t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t);
  let i = 0;
  while (i < tokens.length && isUpper(tokens[i])) i++;
  if (i === 0) return { nom: tokens[0], prenom: tokens.slice(1).join(' ') || '-' };
  if (i === tokens.length) return { nom: tokens.join(' '), prenom: '-' };
  return { nom: tokens.slice(0, i).join(' '), prenom: tokens.slice(i).join(' ') };
}

async function createOne({ nom, prenom, departement, motDePasse }) {
  const identifiant = await uniqueIdentifier(prenom === '-' ? '' : prenom, nom);
  const password = motDePasse || generatePassword();
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    nom: nom.trim(),
    prenom: (prenom || '-').trim(),
    email: identifiant,
    password: hashed,
    role: 'technicien',
    departement,
  });
  return { id: user._id, nom: user.nom, prenom: user.prenom, departement: user.departement, identifiant, motDePasse: password };
}

async function assertDepartment(nom) {
  if (!nom) return false;
  return Department.exists({ nom });
}

function checkPassword(motDePasse) {
  return !motDePasse || String(motDePasse).length >= 4;
}

// POST /api/users — crée UN technicien
exports.createUser = async (req, res) => {
  try {
    const { nom, prenom, departement, motDePasse } = req.body;
    if (!nom || !String(nom).trim()) return res.status(400).json({ message: 'Le nom est obligatoire.' });
    if (!(await assertDepartment(departement))) return res.status(400).json({ message: 'Choisis un département valide.' });
    if (!checkPassword(motDePasse)) return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 4 caractères.' });
    const result = await createOne({ nom: String(nom), prenom: String(prenom || '-'), departement, motDePasse: motDePasse ? String(motDePasse) : '' });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la création du compte.', error: err.message });
  }
};

// POST /api/users/bulk — crée plusieurs techniciens d'un coup (une ligne = un technicien)
exports.createUsersBulk = async (req, res) => {
  try {
    const { departement, lignes, motDePasse } = req.body;
    if (!(await assertDepartment(departement))) return res.status(400).json({ message: 'Choisis un département valide.' });
    const list = (Array.isArray(lignes) ? lignes : String(lignes || '').split(/\r?\n/)).map(parseLine).filter(Boolean);
    if (!list.length) return res.status(400).json({ message: 'Ajoute au moins un nom (un technicien par ligne).' });
    if (list.length > 150) return res.status(400).json({ message: 'Maximum 150 comptes à la fois.' });
    if (!checkPassword(motDePasse)) return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 4 caractères.' });
    const created = [];
    for (const p of list) created.push(await createOne({ ...p, departement, motDePasse: motDePasse ? String(motDePasse) : '' }));
    res.status(201).json({ total: created.length, comptes: created });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la création des comptes.', error: err.message });
  }
};

// GET /api/users?departement=&q=
exports.listUsers = async (req, res) => {
  try {
    const filters = { role: 'technicien' };
    if (req.query.departement) filters.departement = req.query.departement;
    if (req.query.q) {
      filters.$or = [
        { nom: { $regex: req.query.q, $options: 'i' } },
        { prenom: { $regex: req.query.q, $options: 'i' } },
        { email: { $regex: req.query.q, $options: 'i' } },
      ];
    }
    const users = await User.find(filters).sort({ departement: 1, nom: 1 }).limit(1000);
    res.json(users.map((u) => ({ id: u._id, nom: u.nom, prenom: u.prenom, departement: u.departement, identifiant: u.email, actif: u.actif, createdAt: u.createdAt })));
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des comptes.', error: err.message });
  }
};

// PATCH /api/users/:id — nom / prénom / département / activer-désactiver
exports.updateUser = async (req, res) => {
  try {
    const { nom, prenom, departement, actif } = req.body;
    const update = {};
    if (nom !== undefined) update.nom = String(nom).trim();
    if (prenom !== undefined) update.prenom = String(prenom).trim() || '-';
    if (departement !== undefined) {
      if (!(await assertDepartment(departement))) return res.status(400).json({ message: 'Département invalide.' });
      update.departement = departement;
    }
    if (actif !== undefined) update.actif = actif === true || actif === 'true';
    const r = await User.updateOne({ _id: req.params.id, role: 'technicien' }, { $set: update });
    if (!r.matchedCount) return res.status(404).json({ message: 'Compte introuvable.' });
    const user = await User.findById(req.params.id);
    res.json({ id: user._id, nom: user.nom, prenom: user.prenom, departement: user.departement, actif: user.actif });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour.', error: err.message });
  }
};

// POST /api/users/:id/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { motDePasse } = req.body;
    if (!checkPassword(motDePasse)) return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 4 caractères.' });
    const password = motDePasse ? String(motDePasse) : generatePassword();
    const hashed = await bcrypt.hash(password, 10);
    const r = await User.updateOne({ _id: req.params.id, role: 'technicien' }, { $set: { password: hashed } });
    if (!r.matchedCount) return res.status(404).json({ message: 'Compte introuvable.' });
    const user = await User.findById(req.params.id);
    res.json({ identifiant: user.email, nom: user.nom, prenom: user.prenom, motDePasse: password });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la réinitialisation.', error: err.message });
  }
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const r = await User.deleteOne({ _id: req.params.id, role: 'technicien' });
    if (!r.deletedCount) return res.status(404).json({ message: 'Compte introuvable.' });
    res.json({ message: 'Compte supprimé.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression.', error: err.message });
  }
};

exports._internals = { parseLine, slugify };
