# SensBoxd

### 👉 Passer de SensCritique à Letterboxd 👈

![](https://raw.githubusercontent.com/phileastv/SensCritique2Letterboxd/main/img/Sens2Boxd-logo.svg)

Un Script tout simple pour exporter ses données de visionnage SensCritique dans un fichier .CSV compatible avec Letterboxd.

➡️ ➡️ ➡️ [Accès à l'instance principale.](https://sensboxd.phileas.tv) ⬅️ ⬅️ ⬅️

##   😶 Pourquoi

Il y a de plus en plus d'intérêt à avoir un profil complet SensCritique et Letterboxd : les deux plateformes deviennent de plus en plus complémentaires et gagnent chaqu'une en force tous les jours.

Ce projet vient simplement de l'envie d'avoir un profil Letterboxd complet à partir de mes données SensCritique.

Vous pouvez utiliser cet outil toutes les semaines/mois pour remplir toutes vos données manquantes sur Letterboxd !

##   ⚙️ Comment ça marche ?

Cet outil utilise un petit script JavaScript executé en local, qui récupère les données de l'utilisateur depuis l'API de nouvelle version de SensCritique.

Vous obtiendrez à la fin un fichier .CSV contenant tous vos films, la note & la date de visionnage que vous avez entrées sur SensCritique, qu'il est ensuite possible [d'importer sur Letterboxd](https://letterboxd.com/import/).

## 🖥️ Installation et utilisation en local

### Prérequis

- **PHP 7.4+** (recommandé : PHP 8+)
- Un navigateur web moderne

### Installation de PHP (si absent)

**macOS** (via [Homebrew](https://brew.sh/)) :
```bash
brew install php
```

**Linux (Debian/Ubuntu)** :
```bash
sudo apt install php-cli php-curl
```

**Windows** : télécharger depuis [windows.php.net](https://windows.php.net/download/)

### Démarrage du serveur de dev

**Méthode recommandée** (script tout-en-un qui gère les cas particuliers) :
```bash
./dev.sh              # port 9000 par défaut
./dev.sh 8080         # ou choisis ton port
```

**Méthode manuelle** :
```bash
php -S localhost:9000
```

Puis ouvre `http://localhost:9000` dans ton navigateur.

> ⚠️ **Si tu lances depuis le terminal intégré de Cursor** : utilise `./dev.sh` obligatoirement.
> Cursor exporte des variables `HTTP_PROXY` / `HTTPS_PROXY` (proxy sandbox) que PHP/cURL hérite,
> ce qui fait échouer les requêtes vers l'API SensCritique avec l'erreur
> `CONNECT tunnel failed, response 403`. Le script `dev.sh` supprime ces variables au lancement.

### 💡 Workflow de dev

**Vider le cache navigateur** : les fichiers JS et CSS ont un paramètre `?v=NN` qui doit être bumpé à chaque modification :
```html
<script defer src="src/index.js?v=21" charset="utf-8"></script>
<link rel="stylesheet" href="css/style.css?v=21">
```
Incrémente le numéro dans [`index.html`](index.html) pour forcer un rechargement côté navigateur.

**Hard-refresh** pendant le dev pour bypasser le cache HTTP :
- macOS : `Cmd + Shift + R`
- Windows/Linux : `Ctrl + Shift + R`

**DevTools** : ouvrir avec `F12`, onglet **Network** → cocher **Disable cache** pendant que DevTools est ouvert.

### Structure du projet

```
SensBoxd/
├── index.html              # Page principale
├── help.html               # Panneau d'erreur (403, profil privé…)
├── css/style.css           # Styles
├── src/
│   ├── config.js           # Config API, UI, retry/throttle
│   ├── graphql-queries.js  # Query GraphQL UserCollection
│   ├── state-manager.js    # Gestion d'état + listeners
│   ├── index.js            # Logique métier (load, retry, export)
│   └── proxy.php           # Proxy CORS → API SensCritique
├── data/changelog.json     # Changelog affiché sur la page
└── img/, video/            # Assets
```

### À propos du proxy CORS

Pour contourner les restrictions CORS et accéder à l'API SensCritique depuis votre navigateur, ce projet utilise un proxy PHP basé sur [PHP Cross Domain Proxy](https://github.com/softius/php-cross-domain-proxy) créé par [Iacovos Constantinou](https://github.com/softius).

Le proxy (`src/proxy.php`) agit comme un intermédiaire qui :
- Reçoit les requêtes depuis votre script JavaScript
- Les transmet à l'API SensCritique 
- Retourne les réponses à votre navigateur

**Note de sécurité** : Le proxy est configuré pour n'accepter que les requêtes vers les domaines SensCritique autorisés.

##   🙋‍♀️ FAQ

 - *Et les critiques ?*
	 - **Les critiques ne sont pas incluses dans l'export.** D'un point de vue technique, il serait simple de les ajouter. Il est tout de même préférable de faire ce genre de choses à la main pour être sûr du formatage de chaque plateforme. Si c'est très demandé, je pourrai ajouter une option.
 - *Et si je ne veux plus noter mes films sur Letterboxd ?*
	 - Les notes seront incluses dans le .CSV, mais **l'outil d'importation de Letterboxd comporte une case à cocher "Import Ratings" qu'il est possible de décocher**.
 - *J'ai déjà noté certains films sur Letterboxd*
	 - La note est différente, Letterboxd la remplacera par celle de SensCritique.

Ceci un projet personnel non affilié à SensCritique, SensCritique.com ou SENSCRITIQUE SARL, et n'utilise aucune de leurs technologies ou code privé.
