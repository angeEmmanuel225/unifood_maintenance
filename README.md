# UNIFOOD TOGO — Plateforme de maintenance

Créée par **TA BI GOUA Ange Emmanuel** — technicien de maintenance (département Four), ingénieur en formation.
Contact : 99 55 32 17 / 92 40 35 60 — Boutique : https://jgkivbgg.mychariow.shop

Deux sites reliés à la même base MongoDB :

| Site | Adresse | Pour qui |
|---|---|---|
| Espace Technicien | `https://<ton-site>.onrender.com/technicien` | les techniciens de l'usine |
| Espace Administrateur | `https://<ton-site>.onrender.com/responsable` | l'administrateur (M. EDJE Jonathan) |

Les deux s'installent comme une application (PC, Android, iPhone) : une bannière « Installer » s'affiche à chaque visite tant que l'application n'est pas installée.

---

## 1. Ce que fait la plateforme

### Espace Technicien
- **Nouveau rapport** : une vraie fiche, comme la fiche papier
  - en haut : logo UNIFOOD à gauche, les **responsables de département à cocher** (M. IDRISSA, M. AMZA, M. NASSIROU, M. Abdullah, M. Eric) et l'**horaire à cocher** (6h, 14h, 22h, Jour) ;
  - « Rapport journalier des techniciens » puis un **grand tableau** : Machine concernée · Panne ou observations · Tâche effectuée · Début · Fin. Bouton **« Ajouter une panne »** pour chaque nouvelle ligne de la journée ;
  - **photo du rapport écrit** (appareil photo ou galerie), compressée automatiquement sur le téléphone (≈ 100 Ko au lieu de plusieurs Mo), conservée 30 jours ;
  - **signature** au doigt et **date**, puis « Envoyer le rapport ». Tout ce qui est envoyé le même jour rejoint la même fiche.
- **Sauvegarde automatique** : chaque saisie est enregistrée sur le téléphone immédiatement, et sur le serveur quelques secondes après. Si le téléphone s'éteint, si on ferme l'application ou si on change de section, la fiche est retrouvée telle quelle à la réouverture (la photo et la signature, elles, sont gardées sur le téléphone).
- **Sortie magasin** : le technicien déclare les pièces prises au magasin (pièce, référence, quantité, unité, machine/destination). L'administrateur est prévenu ; le technicien voit « Vue ✓ » quand c'est lu.
- **Annonces** : planning de la semaine, messages, photos et PDF publiés par l'administrateur (bannière en haut de l'écran + onglet Annonces).
- Commandes de pièces, historique de ses rapports et commandes.

### Espace Administrateur
- **Comptes** : l'administrateur crée lui-même les accès. Il choisit le département, colle les noms (un par ligne, « NOM Prénom », les « (n) » du planning sont ignorés) et choisit un mot de passe — ou laisse vide pour un mot de passe différent par personne. Les accès s'affichent une fois, à télécharger (CSV/Excel) ou imprimer. Il peut ensuite redonner un mot de passe, désactiver ou supprimer un compte.
- **Rapports reçus** : fiche complète (cases cochées, tableau, signature, photos), statut, PDF, export PDF d'une période, suppression (une fiche ou toute une période).
- **Sorties magasin** : pastille rouge quand il y a du nouveau, « marquer comme vue », export Excel, suppression par période.
- **Annonces** : message + jusqu'à 6 photos/PDF. Le type « Planning de la semaine » se **supprime tout seul** après la date de fin (proposée automatiquement : vendredi de la semaine concernée — publié jeudi/vendredi/samedi, il vaut pour la semaine suivante).
- **Commandes reçues** : statut par article, note, PDF/Word/Excel.

### Place dans la base (offre gratuite 512 Mo)
Photos compressées (≈ 100 Ko) et supprimées après 30 jours, plannings supprimés après leur date, brouillons supprimés après 14 jours, fichiers d'annonce ≤ 5 Mo. Les photos et fichiers ne sont pas copiés dans la sauvegarde Google Drive (seulement le texte).

---

## 2. Installer cette version (une seule fois)

1. **Sauvegarde (conseillé)** : `cd backup && node backup.js` (ou lance la sauvegarde depuis l'onglet *Actions* de GitHub).
2. **Remplace les fichiers** de ton dossier `unifood-app` par ceux de cette archive (garde le dossier caché `.git`). Supprime les anciens fichiers `backend/bulk_create_technicians.js`, `backend/fix_password_ange.js` et `backend/migrate_to_grouped_sheets.js` s'ils existent.
3. **Dépendances** : `cd backend && npm install`
4. **Remise à zéro de la base** (supprime tous les comptes et données, garde seulement l'administrateur, recrée les 5 départements). Avec `backend/.env` qui pointe vers MongoDB Atlas :
   ```
   cd backend
   node reset_database.js --oui
   ```
5. **Mise en ligne** :
   ```
   git add -A
   git commit -m "Fiche de rapport, photos, sauvegarde auto, sorties magasin, comptes administrateur"
   git push
   ```
   Render redéploie tout seul. Rien à changer dans les variables Render.
6. **Connexion administrateur** sur `/responsable` (identifiant `responsable@unifoodtogo.tg`, mot de passe inchangé) → onglet **Comptes** → crée les techniciens département par département.

Changer le mot de passe administrateur : modifier `NOUVEAU_MOT_DE_PASSE` dans `backend/fix_password_responsable.js` puis `node fix_password_responsable.js`.

Logo de la fiche : `technicien/assets/logo-unifood.png` (extrait du planning). Pour un logo plus net, remplace ce fichier par le logo officiel en PNG, même nom.

---

## 3. Installer l'application sur un appareil

- **PC (Chrome / Edge)** et **Android (Chrome)** : bouton « Installer » de la bannière, ou menu ⋮ → « Installer l'application ».
- **iPhone / iPad (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

---

## 4. Structure

```
backend/      API Node.js / Express + MongoDB (Mongoose)
  config/departments.js   les 5 départements et leurs responsables
  models/                 User, Department, Report, ReportPhoto, ReportDraft, Withdrawal, Order, Announcement, AnnouncementFile
  controllers/ routes/    auth, users (comptes), reports (fiche, photos, brouillon), withdrawals (magasin), orders, announcements
  utils/                  PDF de la fiche, exports Word/Excel
  seed.js                 départements + compte administrateur
  reset_database.js       remise à zéro (garde l'administrateur)
technicien/   site des techniciens (fiche.js, magasin.js, dashboard.js, image-tools.js, pwa.js)
responsable/  site de l'administrateur (dashboard.js, comptes.js, image-tools.js, pwa.js)
backup/       sauvegarde quotidienne vers Google Drive (GitHub Actions)
```

## 5. API (résumé)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/login` | connexion (identifiant + mot de passe) |
| GET/POST | `/api/users`, `/api/users/bulk` | administrateur : lister / créer des comptes |
| PATCH/DELETE | `/api/users/:id`, POST `/api/users/:id/reset-password` | administrateur |
| POST | `/api/reports` | technicien : envoyer la fiche (lignes, signature, photos) |
| GET/PUT/DELETE | `/api/reports/draft/me` | technicien : brouillon automatique |
| GET | `/api/reports`, `/api/reports/:id`, `/api/reports/:id/pdf`, `/api/reports/photo/:id` | consultation |
| GET/DELETE | `/api/reports/export/pdf`, `/api/reports/bulk` | administrateur |
| POST/GET | `/api/withdrawals` | sorties magasin |
| PATCH/POST | `/api/withdrawals/:id/vu`, `/api/withdrawals/mark-all-seen` | administrateur |
| GET | `/api/withdrawals/export/excel` | administrateur |
| POST/PATCH (multipart, champ `fichiers`) | `/api/announcements` | administrateur : message + photos + PDF |
| GET | `/api/announcements`, `/api/announcements/files/:id` | tous |

## 6. Hébergement (rappel)

MongoDB Atlas (cluster gratuit M0) + Render (service web gratuit, dossier racine `backend`, `npm install` / `npm start`, variables `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `COMPANY_NAME`, `COMPANY_SUBTITLE`). Sur l'offre gratuite Render, le service s'endort après 15 min sans visite (30 à 60 s pour se réveiller). Passer en payant : Render → Settings → plan payant ; Atlas → Edit Configuration → M10. Aucun changement de code.
