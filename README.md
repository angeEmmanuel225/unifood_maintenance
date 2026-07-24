# UNIFOOD TOGO — Plateforme de Maintenance Industrielle

Application complète pour la gestion des **rapports journaliers de maintenance** et des **commandes de pièces/consommables** de l'usine UNIFOOD TOGO (confiserie).

Le projet est composé de **3 briques connectées** :

1. **`backend/`** — API Node.js/Express + MongoDB (authentification, rapports, commandes, génération PDF/Word/Excel)
2. **`technicien/`** — Site web pour les techniciens (déclarer un rapport, passer une commande, consulter leur historique)
3. **`responsable/`** — Site web pour le responsable maintenance (recevoir les rapports/commandes, les traiter, les exporter en PDF/Word/Excel)

Les deux sites communiquent avec **la même API et la même base de données MongoDB** : tout ce qu'un technicien envoie apparaît immédiatement chez le responsable (et inversement pour les changements de statut).

```
                     ┌───────────────────────┐
                     │   MongoDB (Atlas ou   │
                     │   local)              │
                     └──────────▲────────────┘
                                │
                     ┌──────────┴────────────┐
                     │   backend/  (API)      │
                     │   Express + Mongoose   │
                     └────┬──────────────┬────┘
                          │              │
                 /technicien        /responsable
                 (site 1)           (site 2)
```

---

## 1. Prérequis

- **Node.js** version 18 ou plus récente ([nodejs.org](https://nodejs.org))
- Une base **MongoDB**, au choix :
  - Un cluster gratuit **MongoDB Atlas** (recommandé, aucune installation) → [mongodb.com/atlas](https://www.mongodb.com/atlas)
  - Ou une instance MongoDB installée sur ta machine/serveur

---

## 2. Installation

```bash
cd backend
npm install
cp .env.example .env
```

Ouvre `backend/.env` et renseigne au minimum :

```
MONGO_URI=mongodb+srv://<utilisateur>:<mot-de-passe>@<ton-cluster>.mongodb.net/unifood_maintenance
JWT_SECRET=une-longue-chaine-secrete-a-toi
```

## 3. Initialiser les données de démonstration

Cette commande crée automatiquement :
- Les **départements** de l'usine (Four, Mélange, Moulage, Conditionnement, Utilités, Électricité, Qualité)
- Un **compte technicien** avec les informations fournies (TA BI GOUA Ange Emmanuel)
- Deux autres comptes techniciens de démonstration
- Un **compte responsable maintenance**

```bash
npm run seed
```

Les identifiants créés s'affichent dans la console. Par défaut :

| Rôle | Email | Mot de passe |
|---|---|---|
| Technicien (Four) | bigouaangeemmanuelta@gmail.com | Emmanuel@2026 |
| Technicien (Conditionnement) | kossi.mensah@unifoodtogo.tg | Technicien@2026 |
| Technicien (Utilités) | afi.kuma@unifoodtogo.tg | Technicien@2026 |
| Responsable maintenance | responsable@unifoodtogo.tg | Responsable@2026 |

**Change ces mots de passe dès la mise en production** (aucune fonctionnalité de changement de mot de passe n'est fournie dans cette v1 — modifie-les directement en base ou ajoute cette fonctionnalité si besoin).

## 4. Démarrer l'application

```bash
npm start
```

Tu verras :

```
Serveur UNIFOOD TOGO démarré sur le port 4000
  -> Espace Technicien  : http://localhost:4000/technicien
  -> Espace Responsable : http://localhost:4000/responsable
  -> API                : http://localhost:4000/api
```

Ouvre ces deux adresses dans ton navigateur (par exemple deux onglets) pour tester les deux rôles.

En développement, `npm run dev` relance le serveur automatiquement à chaque modification.

---

## 5. Structure du projet

```
unifood-app/
├── backend/
│   ├── server.js              # point d'entrée : API + sert les 2 sites statiques
│   ├── seed.js                # script d'initialisation des données
│   ├── config/db.js           # connexion MongoDB
│   ├── models/                # User, Department, Report, Order (Mongoose)
│   ├── middleware/auth.js     # vérification du jeton de connexion (JWT) + rôles
│   ├── controllers/           # logique métier (auth, reports, orders, departments)
│   ├── routes/                # définition des routes Express
│   └── utils/                 # génération des PDF (pdfkit), Word (docx), Excel (exceljs)
├── technicien/                # Site 1 — HTML/CSS/JS (aucun framework, aucune dépendance à installer)
│   ├── index.html             # page de connexion
│   ├── dashboard.html         # nouveau rapport / nouvelle commande / historiques
│   ├── css/style.css
│   └── js/ (config.js, login.js, dashboard.js, icons.js)
└── responsable/               # Site 2 — même structure, tableau de bord de supervision
```

---

## 6. Fonctionnalités

### Principe des fiches groupées (important)
Un technicien peut déclarer **plusieurs pannes sur des machines différentes** au cours de la même journée : chaque nouvelle panne déclarée rejoint automatiquement **la même fiche du jour** au lieu de créer une fiche séparée. Le responsable reçoit donc une fiche par technicien par jour, listant toutes les pannes de la journée. Le même principe s'applique aux commandes (plusieurs articles → une seule fiche commande par jour et par technicien).

> ⚠️ Si tu avais déjà des rapports/commandes en base créés avec l'ancienne version (une fiche par panne), lance une fois `node backend/migrate_to_grouped_sheets.js` après avoir mis à jour le code — voir section 6bis ci-dessous. Sans ça, les anciens documents ne s'afficheront pas correctement.

### Espace Technicien (`/technicien`)
- Connexion sécurisée (email + mot de passe)
- **Nouveau rapport journalier** : chaque panne ajoutée (date, horaire, département, responsable de département, machine concernée, statut de la panne, heure de début/fin, description, action menée, observations) rejoint la fiche du jour
- **Nouvelle commande** : chaque article ajouté (désignation, référence, quantité, unité, urgence, motif, date souhaitée) rejoint la commande du jour
- **Mes rapports / Mes commandes** : une ligne par jour, avec le détail de toutes les pannes/articles de la journée accessible en cliquant sur "Voir"
- Téléchargement PDF de ses propres fiches

### Espace Responsable (`/responsable`)
- Tableau de bord avec indicateurs en temps réel
- **Rapports reçus** : une fiche par technicien par jour ; le détail affiche chaque panne individuellement ; changement du statut de la fiche (Nouveau → Lu → Traité)
- **Commandes reçues** : une fiche par technicien par jour ; chaque article a **son propre statut** (En attente/Validée/Rejetée/Livrée) et sa propre note, modifiables indépendamment dans la fenêtre de détail
- **Badge "Exporté"** : indique en un coup d'œil si une fiche a déjà été téléchargée/exportée (PDF/Word/Excel), pour savoir lesquelles peuvent être nettoyées
- **Suppression** : bouton de suppression par fiche, ou bouton "Supprimer la sélection" pour supprimer en masse toutes les fiches correspondant aux filtres actifs (nécessite qu'au moins une date "Du" ou "Au" soit renseignée, par sécurité)
- **Export groupé** : "Exporter tout (PDF)" pour les rapports et "Exporter tout (Excel)" pour les commandes, sur toute une période (filtre de dates)

## 6bis. Migration depuis l'ancienne version (une fiche par panne)

Si ton backend tournait déjà avec l'ancienne version du code (avant les fiches groupées), fais ceci une seule fois après avoir mis à jour les fichiers :

```bash
cd backend
node ../backup/backup.js   # optionnel mais recommandé : une sauvegarde fraîche avant migration
node migrate_to_grouped_sheets.js
```

Ce script est sûr : il renomme tes anciennes collections en `reports_legacy_backup` / `orders_legacy_backup` (jamais supprimées) avant de créer les nouvelles fiches groupées. Si quelque chose te semble anormal après coup, tes données d'origine restent intactes dans ces collections de secours.


---

## 7. Aperçu de l'API

Toutes les routes (sauf `/api/auth/login`) nécessitent l'en-tête `Authorization: Bearer <token>`.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Connexion |
| GET | `/api/auth/me` | tous | Profil courant |
| GET | `/api/departments` | tous | Liste des départements |
| POST | `/api/reports` | technicien | Ajouter une panne à la fiche du jour |
| GET | `/api/reports` | tous | Lister les fiches (filtré par technicien si rôle technicien) |
| GET | `/api/reports/:id` | tous | Détail d'une fiche |
| GET | `/api/reports/:id/pdf` | tous | Télécharger le PDF d'une fiche |
| PATCH | `/api/reports/:id/statut` | responsable | Changer le statut d'une fiche |
| DELETE | `/api/reports/:id` | responsable | Supprimer une fiche |
| DELETE | `/api/reports/bulk` | responsable | Supprimer en masse (filtres en query string, date obligatoire) |
| GET | `/api/reports/export/pdf` | responsable | Export PDF groupé (filtres en query string) |
| POST | `/api/orders` | technicien | Ajouter un article à la commande du jour |
| GET | `/api/orders` | tous | Lister les fiches commande |
| GET | `/api/orders/:id/pdf` \| `/word` \| `/excel` | tous | Télécharger une fiche commande |
| PATCH | `/api/orders/:orderId/items/:itemId/statut` | responsable | Changer le statut d'un article précis |
| DELETE | `/api/orders/:id` | responsable | Supprimer une fiche commande |
| DELETE | `/api/orders/bulk` | responsable | Supprimer en masse (filtres en query string, date obligatoire) |
| GET | `/api/orders/export/excel` | responsable | Export Excel groupé (une ligne par article) |

---

## 8. Déploiement gratuit (MongoDB Atlas + Render)

Ce projet est prêt pour un déploiement 100% gratuit, sans carte bancaire, en une seule brique backend qui sert l'API **et** les deux sites :

1. **Base de données** : crée un cluster gratuit **MongoDB Atlas** (M0, gratuit à vie) et récupère ta chaîne `MONGO_URI` — voir la section précédente.
2. **Code sur GitHub** : pousse ce dossier dans un dépôt GitHub (`git init && git add . && git commit -m "init" && git push`). Le fichier `.gitignore` fourni exclut déjà `node_modules/` et `.env`.
3. **Backend** : sur [render.com](https://render.com), crée un **Web Service** connecté à ton dépôt GitHub :
   - Root Directory : `backend`
   - Build Command : `npm install`
   - Start Command : `npm start`
   - Variables d'environnement : copie tout le contenu de ton `.env` local (MONGO_URI, JWT_SECRET, etc.) dans l'onglet "Environment" de Render.
4. Une fois déployé, Render te donne une URL du type `https://unifood-togo.onrender.com`. Les deux sites sont immédiatement disponibles :
   - `https://unifood-togo.onrender.com/technicien`
   - `https://unifood-togo.onrender.com/responsable`

⚠️ **Limite du gratuit chez Render** : le service s'endort après 15 minutes d'inactivité et met 30 à 60 secondes à se réveiller au premier accès suivant. C'est normal et sans danger pour les données — juste un temps de chargement au réveil. Une astuce gratuite : configurer un ping automatique toutes les 10 minutes avec [UptimeRobot](https://uptimerobot.com) sur `https://ton-url.onrender.com/api/health` pour garder le service éveillé aux heures de travail.

Si tu préfères héberger les deux sites séparément (Netlify, Vercel...) plutôt que via le backend, voir la section suivante.

### Héberger les deux sites séparément (optionnel)

Si tu préfères héberger `technicien/` et `responsable/` sur des domaines/hébergements différents (ex : Netlify, Vercel, GitHub Pages) :

1. Déploie `backend/` séparément (Render, Railway...) et active bien `cors()` (déjà fait dans `server.js`).
2. Dans **chaque** fichier `js/config.js`, remplace :
   ```js
   const API_BASE_URL = '/api';
   ```
   par l'URL complète de ton API, par exemple :
   ```js
   const API_BASE_URL = 'https://api-unifoodtogo.onrender.com/api';
   ```
3. Déploie ensuite chaque dossier (`technicien/`, `responsable/`) comme un site statique indépendant.

---

## 9. Personnalisation rapide

- **Départements / responsables** : modifie le tableau `departments` dans `backend/seed.js`, puis relance `npm run seed`.
- **Couleurs / thème** : les variables de couleur sont en haut de chaque `css/style.css` (`:root { --caramel: ...; --steel: ...; }`).
- **Ajouter un technicien** : le plus simple est d'ajouter une entrée dans `demoUsers` de `seed.js` et de relancer le seed (les comptes existants ne sont pas dupliqués), ou de créer une route d'administration si tu veux gérer ça depuis l'interface plus tard.

---

## 10. Sécurité — à faire avant une mise en production réelle

- [ ] Change tous les mots de passe par défaut
- [ ] Change `JWT_SECRET` dans `.env` (longue chaîne aléatoire)
- [ ] Active HTTPS (via ton hébergeur ou un reverse-proxy comme Nginx + Let's Encrypt)
- [ ] Restreins `cors()` aux domaines exacts de tes deux sites en production plutôt que "tout autoriser"
- [ ] Ajoute une politique de mots de passe / réinitialisation si besoin
