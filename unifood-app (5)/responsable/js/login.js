(function () {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (stored) {
    window.location.href = 'dashboard.html';
    return;
  }

  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add('visible');
  }
  function hideError() {
    errorBox.classList.remove('visible');
    errorBox.textContent = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Connexion...';

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'responsable' }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.message || 'Impossible de se connecter.');
        return;
      }

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: data.token, user: data.user }));
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError('Impossible de joindre le serveur. Vérifiez que le backend est démarré.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Se connecter';
    }
  });
})();
