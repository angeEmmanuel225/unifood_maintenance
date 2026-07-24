// Enregistre le service worker (permet l'installation "Ajouter à l'écran d'accueil" / bureau)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      /* échec silencieux : le site fonctionne normalement même sans service worker */
    });
  });
}
