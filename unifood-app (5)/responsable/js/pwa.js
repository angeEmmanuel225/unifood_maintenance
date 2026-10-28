// Installation de l'application (PWA) : enregistrement du service worker + bannière « Installer »
// affichée à chaque visite (PC, Android, iPhone/iPad) tant que l'application n'est pas installée.
(function () {
  const script = document.currentScript;
  const appName = (script && script.dataset.appName) || 'UNIFOOD';
  const iconPath = (script && script.dataset.icon) || 'assets/icon-192.png';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }

  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  if (isStandalone) return; // déjà installée et ouverte comme application

  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isChromium = /Chrome|Chromium|CriOS|Edg|OPR|SamsungBrowser/.test(ua);
  const isMacSafari = /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua) && !isIOS;
  const isAndroidOther = /Android/.test(ua) && !isChromium;

  let deferredPrompt = null;
  let banner = null;
  const DISMISS_KEY = 'unifood_install_dismissed_' + appName;

  function removeBanner() {
    if (banner) {
      banner.remove();
      banner = null;
    }
  }

  function showBanner(mode) {
    if (banner || sessionStorage.getItem(DISMISS_KEY)) return;
    banner = document.createElement('div');
    banner.className = 'install-banner';
    let text;
    if (mode === 'ios') text = `<strong>Installer ${appName}</strong><span>Touche le bouton <b>Partager</b> (carré avec une flèche) puis <b>« Sur l'écran d'accueil »</b>.</span>`;
    else if (mode === 'safari-mac') text = `<strong>Installer ${appName}</strong><span>Menu <b>Fichier → Ajouter au Dock</b>.</span>`;
    else if (mode === 'manual') text = `<strong>Installer ${appName}</strong><span>Menu du navigateur (⋮) → <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.</span>`;
    else text = `<strong>Installer ${appName}</strong><span>Accès direct depuis ton bureau ou ton écran d'accueil, comme une vraie application.</span>`;
    banner.innerHTML =
      `<img src="${iconPath}" alt="">` +
      `<div class="ib-text">${text}</div>` +
      (mode === 'prompt' ? '<button class="ib-btn" type="button">Installer</button>' : '') +
      '<button class="ib-close" type="button" aria-label="Fermer">✕</button>';
    document.body.appendChild(banner);
    banner.querySelector('.ib-close').addEventListener('click', () => {
      sessionStorage.setItem(DISMISS_KEY, '1');
      removeBanner();
    });
    const btn = banner.querySelector('.ib-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        try {
          await deferredPrompt.userChoice;
        } catch (e) {
          /* ignoré */
        }
        deferredPrompt = null;
        removeBanner();
      });
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showBanner('prompt');
  });
  window.addEventListener('appinstalled', removeBanner);

  window.addEventListener('DOMContentLoaded', () => {
    if (isIOS) setTimeout(() => showBanner('ios'), 800);
    else if (isMacSafari) setTimeout(() => showBanner('safari-mac'), 800);
    else if (isAndroidOther) setTimeout(() => !deferredPrompt && showBanner('manual'), 1500);
  });
})();
