// Notifications push (Web Push) vers les téléphones et PC des techniciens.
// Les clés VAPID sont lues dans les variables d'environnement si elles existent,
// sinon elles sont créées une seule fois et gardées dans la base (rien à configurer sur Render).
const webpush = require('web-push');
const Setting = require('../models/Setting');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

let keysPromise = null;

function getKeys() {
  if (keysPromise) return keysPromise;
  keysPromise = (async () => {
    let publicKey = process.env.VAPID_PUBLIC_KEY;
    let privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      const saved = await Setting.findOne({ cle: 'vapid' });
      if (saved) {
        ({ publicKey, privateKey } = JSON.parse(saved.valeur));
      } else {
        ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
        await Setting.updateOne({ cle: 'vapid' }, { $setOnInsert: { valeur: JSON.stringify({ publicKey, privateKey }) } }, { upsert: true });
        // Si deux démarrages simultanés : on relit la valeur réellement enregistrée
        ({ publicKey, privateKey } = JSON.parse((await Setting.findOne({ cle: 'vapid' })).valeur));
      }
    }
    const subject = process.env.VAPID_SUBJECT || 'mailto:maintenance@unifoodtogo.tg';
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return { publicKey };
  })().catch((err) => {
    keysPromise = null;
    throw err;
  });
  return keysPromise;
}

// Envoie une notification à tous les appareils des techniciens actifs
async function notifyTechnicians(payload) {
  const techs = await User.find({ role: 'technicien', actif: { $ne: false } }).select('_id');
  return sendTo(techs.map((t) => t._id), payload);
}

async function sendTo(userIds, payload) {
  await getKeys();
  if (!userIds.length) return { envoyees: 0, appareils: 0 };
  const subs = await PushSubscription.find({ user: { $in: userIds } });
  const body = JSON.stringify(payload);
  let envoyees = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, body, { TTL: 3 * 24 * 3600 });
        envoyees++;
      } catch (err) {
        // 404 / 410 : l'appareil a désinstallé l'application ou retiré l'autorisation
        if (err && (err.statusCode === 404 || err.statusCode === 410)) await PushSubscription.deleteOne({ _id: s._id });
      }
    })
  );
  return { envoyees, appareils: subs.length };
}

module.exports = { getKeys, notifyTechnicians, sendTo };
