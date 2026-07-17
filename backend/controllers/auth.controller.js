const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  });
}

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user || !user.actif) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }

    // Si l'appelant précise le rôle attendu (site technicien ou site responsable),
    // on vérifie que le compte correspond bien à cet espace.
    if (role && user.role !== role) {
      const espace = role === 'responsable' ? 'Espace Responsable' : 'Espace Technicien';
      return res.status(403).json({
        message: `Ce compte n'est pas autorisé sur ${espace}. Utilisez le site correspondant à votre rôle.`,
      });
    }

    const token = signToken(user);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur lors de la connexion.', error: err.message });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
};
