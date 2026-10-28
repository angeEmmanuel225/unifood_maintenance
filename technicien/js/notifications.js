// Notifications des nouvelles annonces (téléphone et PC des techniciens).
// - Notifications push : arrivent même quand l'application est fermée (Android, PC, iPhone avec l'application installée).
// - Vérification toutes les minutes quand l'application est ouverte (bannière + message à l'écran).
(function () {
  const UF = window.UF;
  const SEEN_KEY = 'unifood_last_announcement_seen';
  const PROMPT_KEY = 'unifood_notif_prompt_closed';
  let knownEndpoint = null;

  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  function b64ToUint8(base64) {
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }
  function deviceName() {
    if (isIOS) return 'iPhone / iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/Windows/i.test(ua)) return 'PC Windows';
    if (/Macintosh/i.test(ua)) return 'Mac';
    return 'Appareil';
  }
  async function registration() {
    return navigator.serviceWorker.ready;
  }
  async function currentSubscription() {
    if (!supported) return null;
    try {
      return await (await registration()).pushManager.getSubscription();
    } catch (e) {
      return null;
    }
  }
  async function sendToServer(sub) {
    const res = await UF.authFetch('/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), appareil: deviceName() }),
    });
    if (!res.ok) throw new Error('serveur');
  }

  // État : 'on' | 'off' | 'denied' | 'ios-install' | 'unsupported'
  async function state() {
    if (isIOS && !isStandalone) return 'ios-install';
    if (!supported) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'granted' && (await currentSubscription())) return 'on';
    return 'off';
  }

  async function enable() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        UF.showToast("Notifications refusées. Tu peux les autoriser plus tard dans les réglages du navigateur.", 'error');
        return render();
      }
      const { publicKey } = await (await UF.authFetch('/push/public-key')).json();
      const reg = await registration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) });
      await sendToServer(sub);
      knownEndpoint = sub.endpoint;
      UF.showToast('Notifications activées sur cet appareil ✓');
      UF.authFetch('/push/test', { method: 'POST' }).catch(() => {});
    } catch (e) {
      UF.showToast("Impossible d'activer les notifications (vérifie ta connexion et réessaie).", 'error');
    }
    render();
  }

  async function disable() {
    const sub = await currentSubscription();
    if (sub) {
      UF.authFetch('/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
      knownEndpoint = null;
    }
    UF.showToast('Notifications désactivées sur cet appareil.');
    render();
  }

  const MESSAGES = {
    on: { title: 'Notifications activées sur cet appareil', text: "Tu es prévenu dès que l'administrateur publie une annonce ou un planning, même application fermée." },
    off: { title: 'Active les notifications', text: "Pour être prévenu sur ce téléphone ou ce PC dès qu'une nouvelle annonce ou un planning est publié." },
    denied: { title: 'Notifications bloquées', text: 'Autorise-les dans les réglages du navigateur (icône 🔒 à gauche de l\'adresse → Notifications → Autoriser), puis recharge la page.' },
    'ios-install': { title: 'Notifications sur iPhone', text: "Installe d'abord l'application : bouton Partager → « Sur l'écran d'accueil », puis ouvre-la depuis l'écran d'accueil et active les notifications ici." },
    unsupported: { title: 'Notifications non disponibles', text: 'Ce navigateur ne gère pas les notifications. Utilise Chrome (Android, PC) ou Safari (iPhone, application installée).' },
  };

  function cardHtml(st, compact) {
    const m = MESSAGES[st];
    const btn =
      st === 'off'
        ? `<button class="btn btn-primary btn-sm" data-act="enable" style="width:auto;">${UF.icon('bell', 15)} Activer</button>`
        : st === 'on' && !compact
          ? `<button class="btn btn-ghost btn-sm" data-act="test">Tester</button><button class="btn btn-ghost btn-sm" data-act="disable">Désactiver</button>`
          : '';
    const close = compact ? `<button class="btn btn-ghost btn-sm" data-act="close" aria-label="Fermer" style="position:absolute; top:6px; right:6px; padding:4px 6px;">${UF.icon('x', 14)}</button>` : '';
    const color = st === 'on' ? '#e6f4ec' : st === 'denied' ? '#fdecef' : '#fff6e0';
    return `<div style="position:relative; display:flex; gap:12px; align-items:center; flex-wrap:wrap; padding:12px ${compact ? '38px' : '14px'} 12px 14px; margin-bottom:14px; border-radius:12px; background:${color}; border:1px solid rgba(0,0,0,0.06);">
      <div style="flex:1; min-width:200px;"><strong style="display:block; font-size:0.92rem;">${UF.icon('bell', 15)} ${m.title}</strong><span style="font-size:0.83rem; color:var(--gray);">${m.text}</span></div>
      ${btn}${close}</div>`;
  }

  function wire(el) {
    el.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'enable') enable();
        if (act === 'disable') disable();
        if (act === 'test') UF.authFetch('/push/test', { method: 'POST' }).then(() => UF.showToast("Notification d'essai envoyée.")).catch(() => {});
        if (act === 'close') {
          sessionStorage.setItem(PROMPT_KEY, '1');
          el.hidden = true;
        }
      })
    );
  }

  async function render() {
    const st = await state();
    const card = document.getElementById('notif-card');
    if (card) {
      card.innerHTML = cardHtml(st, false);
      wire(card);
    }
    // Rappel en haut de l'écran tant que les notifications ne sont pas activées
    const prompt = document.getElementById('notif-prompt');
    if (prompt) {
      const show = (st === 'off' || st === 'ios-install') && !sessionStorage.getItem(PROMPT_KEY);
      prompt.hidden = !show;
      prompt.innerHTML = show ? cardHtml(st, true) : '';
      if (show) wire(prompt);
    }
  }

  // Quand l'application est ouverte : vérifie les nouvelles annonces chaque minute
  async function checkNew(first) {
    if (document.visibilityState !== 'visible') return;
    try {
      const res = await UF.authFetch('/announcements');
      if (!res.ok) return;
      const list = await res.json();
      if (!list.length) return;
      const latest = list[0];
      const seen = localStorage.getItem(SEEN_KEY);
      localStorage.setItem(SEEN_KEY, latest._id);
      if (first || seen === latest._id) return;
      UF.showToast(`Nouvelle annonce : ${latest.titre}`);
      UF.reloadAnnouncements();
    } catch (e) {
      /* hors connexion */
    }
  }

  async function resync() {
    // Garde l'abonnement à jour côté serveur (changement de compte, base remise à zéro...)
    if (!supported || Notification.permission !== 'granted') return;
    const sub = await currentSubscription();
    if (sub) sendToServer(sub).catch(() => {});
  }

  UF.onReady(() => {
    if (location.hash === '#annonces') UF.activateTab('annonces');
    render();
    resync();
    checkNew(true);
    setInterval(() => checkNew(false), 60000);
    document.addEventListener('visibilitychange', () => checkNew(false));
    // Ouverture depuis une notification alors que l'application est déjà ouverte
    if (supported) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'open-annonces') {
          UF.activateTab('annonces');
          UF.reloadAnnouncements();
        }
      });
    }
    // Déconnexion : cet appareil ne reçoit plus les notifications de ce compte
    currentSubscription().then((sub) => (knownEndpoint = sub ? sub.endpoint : null));
    const logout = document.getElementById('logout-btn');
    if (logout) {
      logout.addEventListener(
        'click',
        () => {
          if (!knownEndpoint) return;
          const base = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '/api';
          fetch(`${base}/push/unsubscribe`, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ((UF.auth && UF.auth.token) || '') },
            body: JSON.stringify({ endpoint: knownEndpoint }),
          }).catch(() => {});
        },
        true
      );
    }
  });
})();
