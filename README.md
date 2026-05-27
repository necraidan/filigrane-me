# Filigrane.me

[![Deploy](https://github.com/necraidan/filigrane-me/actions/workflows/deploy.yml/badge.svg)](https://github.com/necraidan/filigrane-me/actions/workflows/deploy.yml)

Application web pour ajouter un filigrane diagonal sur vos images, entièrement traitée dans le navigateur.

**[Accéder à l'application](https://necraidan.github.io/filigrane-me/)**

## Fonctionnalités

- Glisser-déposer ou sélection de fichier (JPG, JPEG, PNG)
- Texte du filigrane personnalisable (jusqu'à 80 caractères)
- Opacité réglable en temps réel
- Export en JPEG (qualité 0.92)
- Aucun stockage, aucune transmission de données

## Stack technique

- **Angular 21** — zoneless, composants standalone, signals
- **Canvas API** — motif diagonal 45° via `CanvasPattern`, sans librairie externe

## Développement local

```bash
npm install
ng serve
```

L'application est disponible sur `http://localhost:4200`.

## Déploiement

Tout push sur `main` déclenche un workflow GitHub Actions qui construit l'application en mode production et déploie le résultat sur la branche `gh-pages`.

## Licence

[MIT](LICENSE)
