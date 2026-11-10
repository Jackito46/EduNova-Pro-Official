# Guide Pratique : Configuration des Variables d'Environnement (.env) & Sécurité Tranzak sur VPS (Coolify / Docker)

Ce guide détaille pas-à-pas la configuration des variables d'environnement pour **EduNova Pro** sur votre serveur VPS (via l'interface **Coolify** ou en ligne de commande **Docker Compose**), en mettant l'accent sur les clés d'API **Tranzak** (MonCash & Natcash) et sur la séparation fondamentale entre variables Frontend (`VITE_`) et variables Backend.

---

## 1. La Frontière de Sécurité Critique : Frontend (`VITE_`) vs Backend (Serveur)

L'un des vecteurs d'attaque les plus fréquents en développement web moderne réside dans la confusion entre variables destinées au client (navigateur) et variables strictement réservées au serveur.

### A. Variables Frontend (Préfixe obligatoire `VITE_`)
* **Où sont-elles exécutées ?** Dans le navigateur de l'utilisateur (Chrome, Safari, Firefox, smartphone).
* **Comment fonctionnent-elles ?** Lors de l'étape de compilation (`vite build`), Vite remplace littéralement chaque occurrence de `import.meta.env.VITE_XXX` par sa valeur en texte clair à l'intérieur des fichiers `.js` générés.
* **Niveau de confidentialité : AUCUN.** Tout utilisateur peut faire `F12 > Inspecter > Sources` ou `Ctrl+U` et lire ces variables.
* **Ce qu'on y met UNIQUEMENT :**
  * `VITE_SUPABASE_URL` : L'adresse publique de l'API Supabase.
  * `VITE_SUPABASE_ANON_KEY` : La clé anonyme publique Supabase (protégée par les règles de sécurité RLS).
  * `VITE_APP_URL` : L'URL publique de l'application.

### B. Variables Backend (Serveur Node.js `server.ts` - Sans préfixe `VITE_`)
* **Où sont-elles exécutées ?** Exclusivement à l'intérieur du conteneur Docker sur votre VPS, dans le processus serveur Node.js (`server.ts`).
* **Comment fonctionnent-elles ?** Elles sont injectées dans la mémoire vive du processus via `process.env.XXX`. Le navigateur web des clients ne peut **JAMAIS** y avoir accès.
* **Niveau de confidentialité : STRICTEMENT CONFIDENTIEL.**
* **Ce qu'on DOIT y mettre :**
  * `TRANZAK_API_KEY` : Clé API secrète de paiement (`tk_live_...`).
  * `TRANZAK_WEBHOOK_SECRET` : Clé secrète de calcul HMAC (`whsec_...`).
  * `ENCRYPTION_KEY` : Clé de chiffrement AES-256 du coffre-fort de la base de données.
  * `SUPABASE_SERVICE_ROLE_KEY` : Clé secrète administrative Supabase (contourne le RLS).
  * `JWT_SECRET`, `CRON_SECRET`, `GEMINI_API_KEY`, mots de passe SMTP.

> 🔴 **RÈGLE DE SÉCURITÉ ABSOLUE :**
> **Ne préfixez JAMAIS les variables Tranzak par `VITE_` !**  
> Si vous écrivez `VITE_TRANZAK_API_KEY`, votre clé secrète sera intégrée au code JavaScript téléchargé par chaque parent ou élève, leur donnant un accès direct à vos fonds Tranzak. Utilisez toujours `TRANZAK_API_KEY`.

---

## 2. Inventaire des Variables Tranzak pour EduNova Pro

| Nom de la Variable | Exemple de Valeur | Rôle & Utilité |
| :--- | :--- | :--- |
| `TRANZAK_API_KEY` | `tk_live_a1b2c3d4...` | Clé API principale de production pour créer les paiements et interroger l'API Tranzak. |
| `TRANZAK_WEBHOOK_SECRET` | `whsec_9f8e7d6c...` | Secret partagé utilisé par le serveur pour vérifier l'authenticité de la signature HMAC-SHA256 de chaque notification de paiement. |
| `TRANZAK_MODE` | `live` ou `test` | Définit si le système interagit par défaut avec la production (`live`) ou le bac à sable (`test`). |
| `TRANZAK_TEST_KEY` | `tk_test_5e6f7a...` | (Optionnel) Clé Sandbox pour exécuter des tests de paiement sans débit réel. |
| `ENCRYPTION_KEY` | Hex 64 car. (32 octets) | Clé maîtresse protégeant le coffre-fort chiffré des établissements en base de données. |

---

## 3. Méthode A : Configuration sur votre VPS via Coolify

Sur l'interface Coolify de votre serveur (ex: `coolify.collegeisaacnewton.com`) :

### Option 1 : Via le mode « Developer View » (Recommandé - En 1 clic)

1. Connectez-vous à votre tableau de bord Coolify.
2. Cliquez sur votre projet, puis sur votre application (**college-isaac-newton**).
3. Dans le menu de gauche, rendez-vous sur **Environment Variables**.
4. En haut à droite du tableau, cliquez sur le bouton **`Developer View`**.
5. Une boîte de texte s'affiche avec la totalité des variables actuelles.
6. Ajoutez à la fin du fichier le bloc suivant en renseignant vos nouvelles clés :

```bash
# =======================================================
# PASSERELLE DE PAIEMENT TRANZAK (MONCASH & NATCASH)
# =======================================================
TRANZAK_API_KEY=tk_live_votre_nouvelle_cle_tranzak_ici
TRANZAK_WEBHOOK_SECRET=whsec_votre_nouveau_secret_webhook_ici
TRANZAK_MODE=live
TRANZAK_TEST_KEY=tk_test_votre_cle_test_sandbox_ici

# =======================================================
# SÉCURITÉ DU COFFRE-FORT DE CHIFFREMENT (AES-256-GCM)
# =======================================================
ENCRYPTION_KEY=votre_cle_aleatoire_hex_32_octets_ici
```

7. Cliquez sur **Save**.
8. Cliquez sur le bouton violet **`Redeploy`** tout en haut à droite.

---

### Option 2 : Via le formulaire « + Add »

Si vous préférez ajouter les variables une par une dans la fenêtre modale :

1. Cliquez sur le bouton bleu **`+ Add`**.
2. Remplissez pour la première variable :
   * **Name** : `TRANZAK_API_KEY`
   * **Value** : Votre clé `tk_live_...`
   * **Build time** : Coché (*Available during build*)
   * **Runtime** : Coché (*Available in the container*)
   * Cliquez sur **Add Variable**.
3. Recommencez pour :
   * **Name** : `TRANZAK_WEBHOOK_SECRET` | **Value** : `whsec_...`
   * **Name** : `TRANZAK_MODE` | **Value** : `live`
4. Cliquez sur **`Redeploy`** tout en haut à droite.

---

## 4. Méthode B : Configuration avec Docker Compose (Sans Coolify)

Si vous déployez votre application directement avec `docker compose` sur votre VPS :

### 1. Fichier `.env` sur le serveur (à placer dans le même dossier que `docker-compose.yml`)

Créez le fichier `.env` sur le serveur :
```bash
nano .env
```

Y insérer :
```env
NODE_ENV=production
PORT=3000

# Variables Frontend (Compilées au build)
VITE_SUPABASE_URL=https://api.votre-domaine.com
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...votre_cle_anon_publique
VITE_APP_URL=https://votre-domaine.com

# Variables Backend (Strictement confidentielles)
ENCRYPTION_KEY=c3ab87e491f03d528b7a6e19c4d2e8f17094b5a3c2e1f8d7b6a5c4e3f2a1b0c9
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...votre_cle_service_role
GEMINI_API_KEY=AIzaSy...votre_cle_gemini

# Passerelle Tranzak
TRANZAK_API_KEY=tk_live_votre_nouvelle_cle_tranzak
TRANZAK_WEBHOOK_SECRET=whsec_votre_nouveau_secret_webhook
TRANZAK_MODE=live
TRANZAK_TEST_KEY=tk_test_votre_cle_sandbox
```

### 2. Extrait du `docker-compose.yml`

```yaml
version: '3.8'

services:
  edunova-app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
        - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
        - VITE_APP_URL=${VITE_APP_URL}
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - TRANZAK_API_KEY=${TRANZAK_API_KEY}
      - TRANZAK_WEBHOOK_SECRET=${TRANZAK_WEBHOOK_SECRET}
      - TRANZAK_MODE=${TRANZAK_MODE}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
```

Pour lancer ou mettre à jour les conteneurs :
```bash
docker compose pull
docker compose up -d --build
```

---

## 5. Configuration du Webhook sur le Portail Tranzak

Pour que les recharges de portefeuille et les règlements de scolarité via MonCash & NatCash soient validés automatiquement en temps réel :

1. Connectez-vous sur votre espace développeur **Tranzak Business Portal** : `https://tranzak.co` ou `https://business.tranzak.co`.
2. Allez dans **Settings** > **Webhooks & API**.
3. Renseignez l'URL de votre endpoint Webhook EduNova Pro :
   ```
   https://votre-domaine.com/api/tranzak/webhook
   ```
   *(Exemple pour votre établissement : `https://collegeisaacnewton.com/api/tranzak/webhook`)*
4. Cochez les événements suivants :
   * `payment.completed`
   * `payment.successful`
   * `payment.failed`
5. Copiez le **Webhook Secret** généré par Tranzak (`whsec_...`) et placez-le dans la variable `TRANZAK_WEBHOOK_SECRET`.

---

## 6. Vérification & Diagnostic depuis l'Interface EduNova Pro

Une fois l'application redéployée, vous pouvez valider le bon fonctionnement sans quitter le logiciel :

1. Connectez-vous en tant qu'Administrateur ou Économe sur EduNova Pro.
2. Allez dans le menu latéral : **Finance** > **Direction Économat**.
3. Cliquez sur le bouton violet en en-tête : **Passerelles & API**.
4. Dans l'onglet **Tranzak**, vérifiez les indicateurs :
   * **Handshake API Tranzak** : Pastille verte ✅ *(Authentification réussie auprès des serveurs Tranzak)*.
   * **Mode Actif** : `Production Live` ou `Sandbox Test`.
   * **Test de Signature HMAC** : Statut Conforme ✅ *(Secret opérationnel)*.
5. Vous pouvez cliquer sur **Tester la connexion** pour mesurer la latence réseau en millisecondes.
