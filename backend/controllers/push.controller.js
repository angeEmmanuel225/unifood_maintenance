const PushSubscription = require('../models/PushSubscription');
const { getKeys, sendTo } = require('../utils/push');

// GET /api/push/public-key
exports.publicKey = async (req, res) => {
  try {
    const { publicKey } = await getKeys();
    res.json({ publicKey });
  } catch (err) {
    res.status(500).json({ message: 'Notifications indisponibles.', error: err.message });
  }
};

// POST /api/push/subscribe { subscription, appareil }
exports.subscribe = async (req, res) => {
  try {
    const sub = req.body && req.body.subscription;
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return res.status(400).json({ message: 'Abonnement invalide.' });
    }
    await PushSubscription.updateOne(
      { endpoint: sub.endpoint },
      { $set: { user: req.user._id, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) }, appareil: String(req.body.appareil || '').slice(0, 120) } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de l'activation des notifications.", error: err.message });
  }
};

// POST /api/push/unsubscribe { endpoint }
exports.unsubscribe = async (req, res) => {
  try {
    if (req.body && req.body.endpoint) await PushSubscription.deleteOne({ endpoint: String(req.body.endpoint), user: req.user._id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur.', error: err.message });
  }
};

// POST /api/push/test — envoie une notification d'essai à ses propres appareils
exports.test = async (req, res) => {
  try {
    const r = await sendTo([req.user._id], {
      title: 'UNIFOOD — Notifications activées ✓',
      body: 'Tu recevras ici les nouvelles annonces et plannings de l\'administrateur.',
      tag: 'test',
      url: '/technicien/dashboard.html#annonces',
    });
    res.json(r);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de l'envoi de l'essai.", error: err.message });
  }
};
