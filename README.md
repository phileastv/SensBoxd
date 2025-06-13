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

- **PHP 5.3+** minimum requis
- Un navigateur web moderne

### Démarrage du serveur

1. Clonez ou téléchargez ce projet
2. Ouvrez un terminal dans le dossier du projet
3. Démarrez le serveur PHP de développement :
```bash
php -S localhost:9000
```
4. Ouvrez votre navigateur à l'adresse : `http://localhost:9000`

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
