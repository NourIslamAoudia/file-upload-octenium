# Upload Media Server

Microservice Node.js **sécurisé** permettant d'uploader des fichiers médias (images et vidéos) vers un serveur FTP distant via une API REST.

---

## Fonctionnement

Le serveur expose un endpoint `POST /api/upload` qui :

1. **Rate limiting** — vérifie que l'IP n'a pas dépassé la limite de requêtes (20 req/min).
2. Reçoit un fichier via un formulaire `multipart/form-data` (champ `file`).
3. Valide le type MIME déclaré (JPEG, PNG, WebP, MP4, QuickTime) et la taille (max 50 Mo).
4. Enregistre temporairement le fichier dans `/tmp` avec un **nom aléatoire** (UUID + timestamp).
5. **Vérifie le type MIME réel** du fichier (magic bytes) via `file-type` pour empêcher l'usurpation d'extension.
6. Transfère le fichier vers un serveur FTP distant configuré via les variables d'environnement.
7. Supprime le fichier temporaire local.
8. Retourne l'URL publique du fichier uploadé.

---

## Stack technique

| Dépendance             | Rôle                                                           |
| ---------------------- | -------------------------------------------------------------- |
| **Express 5**          | Framework HTTP                                                 |
| **Multer 2**           | Gestion des uploads `multipart/form-data`                      |
| **basic-ftp**          | Client FTP pour le transfert vers le serveur distant           |
| **dotenv**             | Chargement des variables d'environnement depuis `.env`         |
| **cors**               | Autorisation des requêtes cross-origin                         |
| **file-type**          | Vérification du type MIME réel (magic bytes) du fichier        |
| **express-rate-limit** | Limitation du nombre de requêtes par IP (protection anti-abus) |

---

## Installation

```bash
git clone https://github.com/NourIslamAoudia/file-upload-octenium.git
cd file-upload-octenium
npm install
```

---

## Configuration

Créer un fichier `.env` à la racine du projet :

```env
FTP_HOST=ftp.example.com
FTP_PORT=21
FTP_USER=votre_utilisateur
FTP_PASSWORD=votre_mot_de_passe
FTP_UPLOAD_PATH=/chemin/vers/dossier/upload
PUBLIC_BASE_URL=https://media.example.com
```

| Variable          | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `FTP_HOST`        | Adresse du serveur FTP                                  |
| `FTP_PORT`        | Port FTP (par défaut `21`)                              |
| `FTP_USER`        | Nom d'utilisateur FTP                                   |
| `FTP_PASSWORD`    | Mot de passe FTP                                        |
| `FTP_UPLOAD_PATH` | Chemin distant où stocker les fichiers                  |
| `PUBLIC_BASE_URL` | URL de base publique pour accéder aux fichiers uploadés |

---

## Lancement

```bash
node server.js
```

Le serveur démarre sur le port **3001**.

---

## Utilisation de l'API

### Health Check

```
GET /
```

**Réponse :**

```json
{ "status": "ok" }
```

---

### Upload d'un fichier

```
POST /api/upload
Content-Type: multipart/form-data
```

| Paramètre | Type   | Description                          |
| --------- | ------ | ------------------------------------ |
| `file`    | `File` | Fichier à uploader (champ form-data) |

#### Types acceptés

- `image/jpeg`
- `image/png`
- `image/webp`
- `video/mp4`
- `video/quicktime`

#### Taille maximale

**50 Mo**

---

## Sécurité

Le serveur implémente plusieurs couches de sécurité :

| Mesure                     | Description                                                                                                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rate Limiting**          | Maximum **20 requêtes par minute** par adresse IP. Au-delà, le serveur retourne une erreur `429 Too Many Requests`.                                                                                                                                             |
| **Nommage aléatoire**      | Les fichiers sont renommés avec un **UUID + timestamp** (`1739612345678-550e8400-e29b-41d4-a716-446655440000.jpg`), ce qui empêche les attaques par **path traversal** et les conflits de noms.                                                                 |
| **Double validation MIME** | Le type MIME est vérifié **deux fois** : d'abord via le header HTTP (filtre rapide Multer), puis via l'analyse des **magic bytes** du fichier réel avec `file-type`. Cela empêche un utilisateur de renommer un exécutable en `.jpg` pour contourner le filtre. |
| **Limite de taille**       | Fichiers limités à **50 Mo** maximum.                                                                                                                                                                                                                           |
| **Nettoyage automatique**  | Les fichiers temporaires sont systématiquement supprimés après le transfert FTP, même en cas d'erreur.                                                                                                                                                          |
| **CORS activé**            | Les requêtes cross-origin sont autorisées de manière contrôlée.                                                                                                                                                                                                 |

---

### Exemples d'appel

#### cURL

```bash
curl -X POST http://localhost:3001/api/upload \
  -F "file=@/chemin/vers/image.jpg"
```

#### JavaScript (fetch)

```javascript
const formData = new FormData();
formData.append("file", fileInput.files[0]);

const response = await fetch("http://localhost:3001/api/upload", {
  method: "POST",
  body: formData,
});

const data = await response.json();
console.log(data.url); // URL publique du fichier
```

#### Python (requests)

```python
import requests

with open("image.jpg", "rb") as f:
    response = requests.post(
        "http://localhost:3001/api/upload",
        files={"file": f}
    )

print(response.json()["url"])
```

---

### Réponses

#### Succès (`200`)

```json
{
  "success": true,
  "url": "https://media.example.com/1739612345678-image.jpg",
  "filename": "1739612345678-image.jpg"
}
```

#### Erreur — aucun fichier (`400`)

```json
{
  "error": "Aucun fichier reçu"
}
```

#### Erreur — fichier invalide ou type non autorisé (`400`)

```json
{
  "error": "Fichier invalide ou type non autorisé"
}
```

#### Erreur — rate limit dépassé (`429`)

```json
{
  "error": "Trop de requêtes, réessaye dans 1 minute."
}
```

#### Erreur — FTP (`500`)

```json
{
  "error": "Erreur FTP : <détail>"
}
```

---

## Intégration comme service

Pour utiliser ce serveur comme microservice dans votre architecture :

1. **Déployer** le serveur sur une machine ou un conteneur (VPS, Docker, etc.).
2. **Configurer** les variables d'environnement FTP.
3. **Appeler** `POST /api/upload` depuis n'importe quel client (frontend, backend, mobile) en envoyant le fichier dans le champ `file`.
4. **Récupérer** l'URL publique retournée dans la réponse pour l'enregistrer dans votre base de données.

### Exemple d'intégration dans un frontend React

```jsx
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("https://votre-domaine.com/api/upload", {
    method: "POST",
    body: formData,
  });

  const { url } = await res.json();
  return url; // Stocker cette URL dans votre BDD
};
```

---

## Limites Vercel

Si vous déployez ce serveur sur **Vercel**, prenez en compte les limites suivantes :

| Limite                   | Valeur                                    |
| ------------------------ | ----------------------------------------- |
| **Request body max**     | **4.5 MB** — hard limit, pas configurable |
| **Maximum memory**       | Hobby : 2 GB, Pro : 4 GB                  |
| **Maximum duration**     | Hobby : 300s, Pro : 800s                  |
| **Function size (gzip)** | 250 MB                                    |

> **⚠️ Important :** La limite de **4.5 MB** sur le body de la requête est un hard limit imposé par Vercel et ne peut pas être modifiée. Cela signifie que les fichiers uploadés ne peuvent pas dépasser cette taille lors d'un déploiement sur Vercel, même si le serveur autorise jusqu'à 50 Mo en local.

---

## Licence

ISC
