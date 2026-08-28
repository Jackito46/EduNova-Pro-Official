# Guide Technique : Déploiement Local (Offline) - EduNova Pro

Ce guide détaille la procédure pour faire fonctionner **EduNova Pro** sur un réseau local privé, sans connexion Internet, pour plusieurs utilisateurs simultanés.

---

## 1. Architecture Matérielle (Hardware)

### A. Le Serveur (Poste Maître)
C'est l'ordinateur qui stocke les données. Il doit être robuste.
- **Processeur** : Intel Core i5 ou i7 (10ème gén+) ou AMD Ryzen 5/7.
- **RAM** : 16 Go minimum (Docker et PostgreSQL sont gourmands).
- **Stockage** : SSD 500 Go (Indispensable pour la vitesse de la base de données).
- **Système** : Ubuntu Server 22.04 LTS (Recommandé) ou Windows 10/11 Pro avec Docker Desktop.

### B. Infrastructure Réseau
- **Switch Ethernet** : Un switch Gigabit (ex: TP-Link 8 ou 16 ports) pour relier les postes fixes.
- **Routeur Wi-Fi** : Pour les tablettes ou ordinateurs portables (ex: WiFi 6 pour plus de stabilité).
- **Câblage** : Câbles Ethernet Catégorie 6 (Cat6) pour garantir 1000 Mbps.

---

## 2. Configuration Logicielle (Software)

### A. Virtualisation avec Docker
Pour faire tourner Supabase en local, vous devez installer **Docker** et **Docker Compose** sur le serveur.
Supabase propose une version "Self-Hosted" qui inclut :
- **PostgreSQL** (Base de données)
- **GoTrue** (Gestion des utilisateurs/Logins)
- **PostgREST** (API pour l'application)
- **Kong** (Passerelle réseau)

### B. Installation de Supabase Local
1. Clonez le dépôt CLI de Supabase ou utilisez Docker Compose :
   ```bash
   git clone --depth 1 https://github.com/supabase/supabase
   cd supabase/docker
   cp .env.example .env
   docker-compose up -d
   ```
2. Notez les clés générées dans le fichier `.env` (ANON_KEY, SERVICE_ROLE_KEY).

---

## 3. Configuration Réseau du Serveur

### A. Adresse IP Statique
Le serveur doit toujours avoir la même adresse sur le réseau.
- Allez dans les paramètres réseau du serveur.
- Fixez l'IP : `192.168.1.100` (par exemple).
- Masque : `255.255.255.0`
- Passerelle : `192.168.1.1` (votre routeur).

### B. Pare-feu (Firewall)
Pour que les autres ordinateurs puissent accéder au serveur, vous devez ouvrir les "portes" de sécurité.

#### Sur Linux (Ubuntu avec UFW) :
Exécutez ces commandes dans le terminal du serveur :
```bash
# Autoriser l'application
sudo ufw allow 3000/tcp
# Autoriser l'API Supabase
sudo ufw allow 8000/tcp
# Autoriser la base de données (si accès externe requis)
sudo ufw allow 5432/tcp
# Recharger le pare-feu
sudo ufw reload
```

#### Sur Windows (Pare-feu Windows Defender) :
1. Ouvrez le **Panneau de configuration** > **Système et sécurité** > **Pare-feu Windows Defender**.
2. Cliquez sur **Paramètres avancés** (à gauche).
3. Cliquez sur **Règles de trafic entrant** > **Nouvelle règle**.
4. Choisissez **Port** > **Suivant**.
5. Sélectionnez **TCP** et saisissez les ports : `3000, 8000, 5432`.
6. Choisissez **Autoriser la connexion** > **Suivant**.
7. Cochez toutes les cases (Domaine, Privé, Public) > **Suivant**.
8. Nommez la règle : `EduNova Pro Local` et cliquez sur **Terminer**.

---

## 4. Déploiement de l'Application

1. **Build de l'App** : Sur votre machine de développement, générez les fichiers de production :
   ```bash
   npm run build
   ```
2. **Transfert** : Copiez le dossier `dist/` sur le serveur.
3. **Serveur Web** : Utilisez un serveur léger comme `serve` ou `Nginx` pour diffuser l'app sur le port 3000.
   ```bash
   npx serve -s dist -l 3000
   ```

---

## 5. Accès pour les Utilisateurs

Sur n'importe quel autre ordinateur relié au switch ou au Wi-Fi :
1. Ouvrez Google Chrome.
2. Tapez l'adresse : `http://192.168.1.100:3000`
3. L'application se chargera instantanément.

---

## 6. Stratégie de Sauvegarde (Critique)

Puisqu'il n'y a pas de Cloud, vous êtes responsable des données :
1. **Script de Backup** : Créez une tâche planifiée (Cron) qui exporte la base de données chaque soir à 17h.
   ```bash
   docker exec -t supabase-db pg_dumpall -c -U postgres > backup_$(date +%Y-%m-%d).sql
   ```
2. **Double Stockage** : Copiez automatiquement ce fichier sur une **clé USB** ou un **disque dur externe** branché au serveur.

---

## 7. Sécurisation du Réseau Local

Même en mode hors-ligne, la sécurité est primordiale pour éviter qu'un utilisateur non autorisé (ex: un élève curieux) n'accède directement à la base de données.

### A. Restriction par Plage d'IP (Le "Cercle de Confiance")
Au lieu d'ouvrir les ports à tout le monde, restreignez l'accès uniquement aux adresses de l'école.

#### Sur Linux (UFW) :
Si votre réseau utilise la plage `192.168.1.0` à `192.168.1.255` :
```bash
# Supprimer les règles génériques précédentes
sudo ufw delete allow 3000/tcp
sudo ufw delete allow 8000/tcp

# Autoriser uniquement le réseau de l'école
sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 8000 proto tcp
```

#### Sur Windows :
1. Dans les **Paramètres avancés** du Pare-feu, double-cliquez sur votre règle `EduNova Pro Local`.
2. Allez dans l'onglet **Portée**.
3. Sous **Adresse IP distante**, cochez **Ces adresses IP**.
4. Cliquez sur **Ajouter** et saisissez la plage (ex: `192.168.1.0/24`) ou les IPs spécifiques des ordinateurs du secrétariat.

### B. Mots de Passe Forts (Base de Données)
Dans votre fichier `docker/.env`, ne laissez **JAMAIS** les mots de passe par défaut (`postgres`, `password`).
- Utilisez un générateur de mots de passe pour `POSTGRES_PASSWORD`.
- Changez les clés `JWT_SECRET` et `ANON_KEY` lors de l'installation initiale.

### C. Sécurité Physique
- Le serveur doit être placé dans un endroit **verrouillé** (ex: le bureau du directeur).
- Désactivez le Wi-Fi "Invité" sur votre routeur pour éviter que des personnes extérieures ne se connectent au réseau local de l'école.

---

**Note de l'Expert** : Cette configuration permet une autonomie totale. L'école peut fonctionner même en cas de coupure totale d'Internet ou de câbles sous-marins sectionnés.
