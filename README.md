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

### Espace Technicien (`/technicien`)
- Connexion sécurisée (email + mot de passe)
- **Nouveau rapport journalier** : date, horaire (06h-14h / 14h-22h / 22h-06h / Journée 08h-16h), département, responsable de département, machine concernée, statut de la panne, heure de début/fin, description de la panne, action menée, observations
- **Nouvelle commande** : désignation, référence, quantité, unité, urgence (Normale/Urgente/Critique), motif, date souhaitée
- Historique personnel des rapports et commandes avec filtres et suivi de statut
- Téléchargement PDF de ses propres rapports/commandes

### Espace Responsable (`/responsable`)
- Tableau de bord avec indicateurs en temps réel (rapports du jour, pannes en cours, commandes en attente/urgentes)
- **Rapports reçus** : filtrage par département/statut/dates/recherche, changement du statut (Nouveau → Lu → Traité), téléchargement PDF individuel, **export PDF groupé** de tous les rapports filtrés
- **Commandes reçues** : filtrage par département/statut/urgence/dates/recherche, changement du statut (En attente → Validée/Rejetée/Livrée), ajout d'une note, téléchargement **PDF, Word (.docx) et Excel (.xlsx)** par commande, **export Excel groupé** de toutes les commandes filtrées

---

## 7. Aperçu de l'API

Toutes les routes (sauf `/api/auth/login`) nécessitent l'en-tête `Authorization: Bearer <token>`.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Connexion |
| GET | `/api/auth/me` | tous | Profil courant |
| GET | `/api/departments` | tous | Liste des départements |
| POST | `/api/reports` | technicien | Créer un rapport |
| GET | `/api/reports` | tous | Lister les rapports (filtré par technicien si rôle technicien) |
| GET | `/api/reports/:id` | tous | Détail d'un rapport |
| GET | `/api/reports/:id/pdf` | tous | Télécharger le PDF d'un rapport |
| PATCH | `/api/reports/:id/statut` | responsable | Changer le statut d'un rapport |
| GET | `/api/reports/export/pdf` | responsable | Export PDF groupé (filtres en query string) |
| POST | `/api/orders` | technicien | Créer une commande |
| GET | `/api/orders` | tous | Lister les commandes |
| GET | `/api/orders/:id/pdf` \| `/word` \| `/excel` | tous | Télécharger une commande |
| PATCH | `/api/orders/:id/statut` | responsable | Changer le statut d'une commande |
| GET | `/api/orders/export/excel` | responsable | Export Excel groupé |

---

## 8. Déploiement

Ce projet est prêt pour un déploiement simple (un seul serveur Node sert l'API + les deux sites) :

- **Hébergeur backend** : Render, Railway, un VPS, etc. Définis les variables d'environnement du fichier `.env` sur la plateforme choisie.
- **Base de données** : MongoDB Atlas (gratuit pour un usage de cette taille).
- Une fois déployé, `https://ton-domaine.com/technicien` et `https://ton-domaine.com/responsable` sont utilisables directement.

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
