# 🚀 Guide d'Installation Locale - EduNova Pro

Ce guide vous explique comment installer et faire fonctionner **EduNova Pro** sur votre propre ordinateur ou sur le serveur local d'un client.

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé :
1. **Node.js** (Version 18 ou plus)
2. **Docker Desktop** (Essentiel pour faire tourner l'écosystème Supabase en local)
3. **Supabase CLI** :
   - Sur Windows (via PowerShell) : `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` puis `scoop install supabase`
   - Ou via NPM : `npm install supabase --save-dev`

---

## 🛠️ Étape 1 : Initialisation du projet local

Ouvrez un terminal dans le dossier du projet et exécutez :

```bash
# Initialiser la configuration Supabase
npx supabase init

# Démarrer les services (Postgres, Auth, API, Storage)
npx supabase start
```

Une fois terminé, le terminal affichera vos identifiants locaux :
- **API URL** : `http://127.0.0.1:54321`
- **DB URL** : `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **Studio URL** : `http://127.0.0.1:54323` (Interface type Supabase mais en local)

---

## 💾 Étape 2 : Importation des données Cloud vers Local

Puisque vous utilisez **pgAdmin** ou **DBeaver**, voici la marche à suivre :

### 1. Exporter depuis le Cloud (Supabase)
Récupérez votre chaîne de connexion dans *Settings > Database* sur le tableau de bord Supabase.
Utilisez votre terminal pour faire une sauvegarde :
```bash
pg_dump -h db.votre-id.supabase.co -U postgres postgres > backup_edunova.sql
```

### 2. Importer dans votre instance locale
Avec **DBeaver** ou **pgAdmin** :
1. Connectez-vous à votre base locale (`localhost:54322`).
2. Faites un clic droit sur la base `postgres`.
3. Choisissez **Outils > Restore** (pgAdmin) ou **Execute SQL Script** (DBeaver).
4. Sélectionnez le fichier `backup_edunova.sql`.

*Note : Si vous utilisez Supabase CLI, vous pouvez aussi simplement copier vos fichiers SQL dans le dossier `supabase/migrations` et ils seront appliqués automatiquement.*

---

## ⚙️ Étape 3 : Configuration de l'Application

Créez un fichier `.env.local` à la racine du projet :

```env
# Utilisez les valeurs affichées par 'supabase start'
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=votre_cle_anon_locale_generee
GEMINI_API_KEY=votre_cle_gemini_si_besoin
```

---

## 🚀 Étape 4 : Lancement de l'interface

```bash
# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

L'application est maintenant disponible sur **`http://localhost:3000`**.

---

## 💡 Conseils de l'Expert pour vos Clients

1. **Persistance** : Les données dans Docker sont persistantes. Même si vous éteignez le PC, les données seront là au redémarrage.
2. **Accès Réseau** : Pour que d'autres PC de l'école accèdent au système, remplacez `localhost` par l'adresse IP du PC serveur (ex: `192.168.1.10`).
3. **Sécurité** : En local, assurez-vous que le pare-feu du PC autorise le port `3000` (Interface) et `54321` (API).
4. **Sauvegardes** : Apprenez à vos clients à faire un `pg_dump` hebdomadaire sur une clé USB. C'est leur assurance vie !

---
*Document généré par votre Expert EduNova.*
