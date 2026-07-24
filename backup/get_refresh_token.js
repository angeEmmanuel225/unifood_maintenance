const http = require('http');
const { google } = require('googleapis');

// ============================================================
// Colle ici les valeurs de ton "OAuth Client ID" (type Application de bureau)
// créé dans Google Cloud Console.
// ============================================================
const CLIENT_ID = 'COLLE_ICI_TON_CLIENT_ID';
const CLIENT_SECRET = 'COLLE_ICI_TON_CLIENT_SECRET';

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}`;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

console.log('\n1) Ouvre cette adresse dans ton navigateur, connecte-toi avec TON compte Google, et autorise l\'accès :\n');
console.log(authUrl);
console.log('\n2) Cette page va rediriger vers une page qui ne charge pas (localhost) — c\'est normal, reviens ici.\n');
console.log('En attente de ton autorisation... (ne ferme pas ce terminal)\n');

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, REDIRECT_URI);
    const code = url.searchParams.get('code');

    if (!code) {
      res.end('En attente de l\'autorisation...');
      return;
    }

    res.end('Autorisation reçue ! Tu peux fermer cet onglet et revenir au terminal.');
    server.close();

    const { tokens } = await oAuth2Client.getToken(code);
    console.log('\n✅ Voici ton refresh token (garde-le précieusement, ne le partage avec personne) :\n');
    console.log(tokens.refresh_token);
    console.log('\nCopie cette valeur : c\'est elle qu\'il faut mettre dans le secret GitHub GOOGLE_REFRESH_TOKEN.\n');
    process.exit(0);
  } catch (err) {
    console.error('Erreur lors de l\'échange du code :', err.message);
    process.exit(1);
  }
});

server.listen(PORT);
