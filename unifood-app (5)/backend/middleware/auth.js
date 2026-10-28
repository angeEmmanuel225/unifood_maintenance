const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    if (!token) {
      return res.status(401).json({ message: 'Non authentifié. Veuillez vous reconnecter.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.actif) {
      return res.status(401).json({ message: 'Compte introuvable ou désactivé.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expirée ou invalide. Veuillez vous reconnecter.' });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Vous n'avez pas les droits pour effectuer cette action." });
    }
    next();
  };
}

module.exports = { protect, allowRoles };
