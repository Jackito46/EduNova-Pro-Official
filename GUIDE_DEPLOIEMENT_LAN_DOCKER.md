# Guide Complet Post-Docker : Déploiement Serveur Local (LAN) & Poste Autonome

Ce document décrit **tout ce dont vous avez besoin après l'installation de Docker** pour exploiter **EduNova Pro** localement sans connexion Internet, soit sur un **Poste Autonome (1 PC)** soit sur un **Serveur Local d'Établissement (plusieurs PC/tablettes sur le réseau LAN)**.

---

## 0. Pré-requis Windows avant l'installation de Docker Desktop

Si l'installeur Docker affiche : *« Docker Desktop requires the "Virtual Machine Platform" Windows feature »* :
1. Ouvrez **PowerShell en tant qu'Administrateur** et exécutez le script préparateur :
   ```powershell
   powershell -ExecutionPolicy Bypass -File deploy\local-lan\prepare-windows-docker.ps1
   ```
   *(ou manuellement : `wsl --install --no-distribution`)*
2. **Redémarrez obligatoirement l'ordinateur**.
3. Relancez `Docker Desktop Installer.exe` (clic droit > **Exécuter en tant qu'administrateur**, puis choisissez **"All-users installation"**).
4. Si l'erreur persiste au lancement de Docker, vérifiez dans le **Gestionnaire des tâches > Performance > Processeur** que **Virtualisation : Activée** apparaît (sinon activez `Intel VT-x` ou `AMD SVM` dans le BIOS).

---

## 1. Démarrage de la Stack Locale (5 minutes)

### Installation Automatisée sous Windows (Recommandée)
Une fois Docker Desktop démarré (**Engine running**), exécutez dans **PowerShell (Administrateur)** à la racine du projet :
```powershell
powershell -ExecutionPolicy Bypass -File deploy\local-lan\install-serveur-local.ps1
```
Ce script détecte automatiquement votre IP LAN, génère `.env.local` (même si Node.js n’est pas installé sur le PC), ouvre le pare-feu sur le port `3000`, télécharge les images Supabase (`Postgres`, `GoTrue`, `PostgREST`, `Storage`, `Kong`) et démarre les 6 conteneurs.

### Ou Installation Manuelle (Linux / macOS / Windows)
1. **Générer `.env.local`** :
   - **Mode Serveur Local d'Établissement (LAN multi-PC)** :
     ```bash
     node deploy/local-lan/setup-local-env.mjs --mode=lan --ip=192.168.1.100 --label="Collège Saint-Paul"
     ```
   - **Mode Poste Autonome (un seul PC hors-ligne)** :
     ```bash
     node deploy/local-lan/setup-local-env.mjs --mode=standalone
     ```
2. **Lancer les 6 conteneurs Docker** (à faire avec Internet la première fois afin de mettre en cache les images ; ensuite plus besoin d'Internet) :
   ```bash
   docker compose -f docker-compose.local.yml --env-file .env.local up -d --build
   ```
   Vérifiez que tous les services et la base répondent :
   - **Windows PowerShell** :
     ```powershell
     powershell -ExecutionPolicy Bypass -File deploy\local-lan\verify-local.ps1
     ```
   - **Linux / macOS** :
     ```bash
     docker compose -f docker-compose.local.yml --env-file .env.local ps
     ```

---

## 2. Importation du Schéma & des Données de l'École

Un conteneur PostgreSQL neuf est vide au premier démarrage. Il faut y charger votre base EduNova existante depuis Supabase Cloud (ou un fichier `.sql` local) :

### Option A — Cloner automatiquement votre base Online (Supabase Cloud) vers Local
Aucun outil PostgreSQL n'est requis sur Windows (tout passe par `edunova-db`).  
Dans le dashboard Supabase Cloud, cliquez sur **Connect** > **Session pooler** et copiez l'URI `postgresql://...`, puis lancez :
- **Windows PowerShell** :
  ```powershell
  powershell -ExecutionPolicy Bypass -File deploy\local-lan\import-cloud-to-local.ps1
  ```
- **Linux / macOS** :
  ```bash
  bash deploy/local-lan/import-cloud-to-local.sh
  ```
*(Ce script sauvegarde votre base locale, importe tout le schéma + données `public` ainsi que les comptes `auth.users` / `auth.identities` avec les mêmes mots de passe, puis recharge PostgREST.)*

### Option B — Restaurer un fichier `.sql` déjà exporté
- **Windows PowerShell** :
  ```powershell
  powershell -ExecutionPolicy Bypass -File deploy\local-lan\restore-local.ps1 -SqlFile .\backup_cloud_edunova.sql
  ```
- **Linux / macOS** :
  ```bash
  bash deploy/local-lan/restore-local.sh ./backup_cloud_edunova.sql
  ```

### Option C — Nouvelle installation vierge
Appliquez les scripts SQL de référence (`sql/schema.sql`, `sql/academic_and_roles.sql`, `sql/finance_final_v2.sql`, `sql/offline_first_sync_rpcs.sql`, etc.) via `restore-local.ps1` / `restore-local.sh` ou **pgAdmin** (`docker compose -f docker-compose.local.yml --env-file .env.local --profile admin up -d` puis `http://localhost:5050`).

---

## 3. Configuration Réseau du Poste Serveur (Mode LAN uniquement)

*Inutile si vous utilisez le Mode Poste Autonome (`localhost:3000`).*

1. **Adresse IP Fixe (Statique)** sur la carte réseau Ethernet du serveur (ex: `192.168.1.100`, masque `255.255.255.0`, passerelle `192.168.1.1`) ou réservation DHCP MAC sur le routeur de l'école.
2. **Ouverture du Pare-feu sur le port unique `3000/TCP`** :
   Grâce au proxy interne `/local-supabase`, **un seul port (`3000`)** suffit pour toute l'application et la base !
   - **Windows (PowerShell Administrateur)** :
     ```powershell
     New-NetFirewallRule -DisplayName "EduNova Pro LAN (Port 3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
     ```
   - **Ubuntu Linux (UFW)** :
     ```bash
     sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
     sudo ufw reload
     ```
3. **Désactiver la mise en veille du PC Serveur** (Options d'alimentation : *Jamais mettre en veille*) et brancher le serveur + le switch sur un **onduleur (UPS)**.
4. **Définir un nom réseau local facile (`http://edunova-server.local:3000`)** :
   - **Windows (PowerShell Administrateur)** :
     ```powershell
     powershell -ExecutionPolicy Bypass -File deploy\local-lan\set-lan-hostname.ps1 -Hostname "edunova-server"
     ```
     Ce script renomme le poste Windows (`edunova-server`, max 15 caractères), met à jour `LAN_HOSTNAME=edunova-server.local` dans `.env.local`, ouvre le port mDNS (`UDP 5353`) et redémarre les conteneurs `edunova-app` / `edunova-auth`. Un redémarrage Windows peut être demandé une fois pour diffuser le nouveau nom sur tout le réseau.
   - **Linux / Ubuntu (mDNS Avahi)** :
     ```bash
     sudo bash deploy/local-lan/set-lan-hostname.sh edunova-server
     ```

---

## 4. Connexion des Postes Clients (Secrétariat, Économat, Direction)

Sur n'importe quel autre ordinateur ou tablette relié au Wi-Fi / câble de l'école :
1. Ouvrez Google Chrome ou Microsoft Edge.
2. Accédez directement à l'adresse nominative **`http://edunova-server.local:3000`** (ou à l'IP affichée dans `/offline`, par ex. **`http://192.168.1.100:3000`**).
3. Aucune configuration client manuelle n'est requise : l'application charge automatiquement `/runtime-config.js` et dialogue avec la base locale via `/local-supabase`.

*(Astuce Android / vieux PC sans mDNS)* : si un appareil ne résout pas `.local`, utilisez directement l'IP fixe (`http://192.168.1.100:3000`) ou ajoutez `<IP_SERVEUR> edunova-server.local` dans son fichier `hosts`.

*(Optionnel)* Si un poste client était déjà connecté au Cloud et doit basculer vers le serveur local, ouvrez `/offline` > section **Serveur Local (LAN) & Poste Autonome** et saisissez l'adresse IP ou `http://edunova-server.local:3000`.

---

## 5. Sauvegardes Quotidiennes & Assurance Matérielle

En installation locale, **aucun cloud ne détient vos données** :
- Planifiez `deploy/local-lan/backup-local.ps1` (Planificateur de tâches Windows, chaque jour à 17h30) ou un cron Linux :
  ```cron
  30 17 * * 1-6 /chemin/vers/deploy/local-lan/backup-local.sh /chemin/vers/backups
  ```
- Copiez chaque semaine le dossier `./backups/` sur un **disque dur externe ou une clé USB conservée hors du local**.

---

## 6. Note de Sécurité HTTPS sur Réseau Local (Recommandé pour tablettes PWA)

Sur `http://localhost:3000`, les navigateurs activent toutes les APIs de sécurité (Service Worker PWA + WebCrypto AES-256).  
Sur les autres PC du LAN accédant en HTTP (`http://192.168.1.100:3000`), EduNova Pro reste 100% fonctionnel grâce à son mode de compatibilité HTTP LAN intégré. Toutefois, pour activer l'installation PWA et le chiffrement WebCrypto natif sur tous les postes du réseau, placez un certificat local interne via **Caddy** (`tls internal`) devant le port `3000` (port `443 -> localhost:3000`).
