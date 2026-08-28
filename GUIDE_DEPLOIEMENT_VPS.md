# Guide de Déploiement Complet (VPS Hostinger + Coolify)

Ce guide détaille les étapes pour héberger à la fois **l'Application Web (EduNova)** et **la Base de données (Supabase)** sur le même serveur VPS Hostinger en utilisant Coolify.

## Prérequis
- Un VPS Hostinger (Nous recommandons le plan **KVM 4** ou plus, car Supabase consomme pas mal de RAM : ~4 Go à lui seul).
- Système d'exploitation : **Ubuntu 22.04 LTS** ou **24.04 LTS**.
- Un nom de domaine (ex: `edunova.ht`).

---

## Étape 1 : Installation de Coolify sur le VPS
1. Connectez-vous à votre VPS en SSH via le terminal Hostinger ou votre terminal local :
   ```bash
   ssh root@ip_de_votre_vps
   ```
2. Lancez le script d'installation officiel de Coolify :
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```
3. Une fois terminé, ouvrez votre navigateur et allez sur `http://ip_de_votre_vps:8000`.
4. Créez votre compte administrateur Coolify.

---

## Étape 2 : Déploiement de Supabase (Auto-hébergé)
Coolify propose Supabase en un seul clic !
1. Dans Coolify, allez dans **Projects** > Créez un projet > Sélectionnez **Service / One-click app**.
2. Cherchez **Supabase** dans la liste et cliquez dessus.
3. Configurez les domaines (ex: `api.edunova.ht` ou l'IP du serveur).
4. **Important** : Allez dans l'onglet *Configuration / Environment Variables* et notez vos clés :
   - `ANON_KEY`
   - `SERVICE_ROLE_KEY`
   - Le mot de passe Postgres généré.
5. Cliquez sur **Deploy**. Coolify va télécharger et démarrer tous les conteneurs (Base de données PostgreSQL, Auth, Realtime, Storage, Storage API, etc.).

---

## Étape 3 : Migration de votre base actuelle vers la nouvelle
Comme vous quittez Supabase Cloud, il faut transférer les tables et données.
1. Depuis Supabase Cloud, allez dans Settings > Database et récupérez l'URL de connexion.
2. Utilisez un outil comme `pg_dump` ou DBeaver pour exporter vos métadonnées (schémas et tables) et vos données.
3. Importez ces données dans votre nouveau PostgreSQL hébergé sur votre VPS (accessible via les identifiants fournis par Coolify dans la configuration du service Supabase).

---

## Étape 4 : Déploiement de l'Application EduNova
1. Dans Coolify, créez une nouvelle ressource : **Public/Private Repository** (connectez votre GitHub où se trouve le code).
2. Sélectionnez la branche Principale (ex: `main`).
3. Coolify détectera automatiquement le fichier `Dockerfile` que nous avons créé.
4. Dans **Environment Variables**, ajoutez les variables de l'application pointant vers votre nouveau Supabase :
   - `VITE_SUPABASE_URL` = `https://api.edunova.ht` (ou l'URL fixée à l'étape 2)
   - `VITE_SUPABASE_ANON_KEY` = *<La clé Anon notée à l'étape 2>*
   - *Tout autre variable nécessaire (Email, MonCash, etc.)*
5. Liez un domaine à votre application (ex: `app.edunova.ht`).
6. Cliquez sur **Deploy**. 

---

## Avantages de cette architecture
1. **Zéro Pause** : Vous lancez votre propre serveur, la base de données ne s'endormira jamais.
2. **Latence Ultra-faible** : L'application Node.js/React et la base de données Supabase sont sur le même disque/Réseau local interne. Interrogation instantanée !
3. **Contrôle Total** : Sauvegardes automatisées configurables directement via Coolify, accès DB direct.
4. **Pas de limites tarifaires Supabase Cloud** : Bande passante, taille de base de données limitées uniquement par le disque dur du VPS de Hostinger 50/100 Go NVMe).
