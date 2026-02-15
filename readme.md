# Upload Media Server

Microservice Node.js permettant d'uploader des fichiers médias (images et vidéos) vers un serveur FTP distant via une API REST.

---

## Fonctionnement

Le serveur expose un endpoint `POST /api/upload` qui :

1. Reçoit un fichier via un formulaire `multipart/form-data` (champ `file`).
2. Valide le type MIME (JPEG, PNG, WebP, MP4, QuickTime) et la taille (max 50 Mo).
3. Enregistre temporairement le fichier dans `/tmp`.
4. Transfère le fichier vers un serveur FTP distant configuré via les variables d'environnement.
5. Supprime le fichier temporaire local.
6. Retourne l'URL publique du fichier uploadé.

---

## Stack technique

| Dépendance    | Rôle                                                   |
| ------------- | ------------------------------------------------------ |
| **Express 5** | Framework HTTP                                         |
| **Multer 2**  | Gestion des uploads `multipart/form-data`              |
| **basic-ftp** | Client FTP pour le transfert vers le serveur distant   |
| **dotenv**    | Chargement des variables d'environnement depuis `.env` |
| **cors**      | Autorisation des requêtes cross-origin                 |

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

#### Erreur — type non autorisé (`400`)

```json
{
  "error": "Type non autorisé"
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

## Licence

ISC
