# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.39.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.


## Organisation Hammey

Le front-end Angular consomme le serveur Node/Express via des appels relatifs comme `/api/produits`.

- `src/app/app.ts` : état de la boutique, filtres, panier et fiche produit.
- `src/app/app.html` : template de l’interface.
- `src/app/app.scss` : styles Hammey.
- `src/app/models/product.ts` : modèle de produit.
- `src/app/services/product.service.ts` : client HTTP du catalogue.
- `src/app/app.routes.ts` : routes Angular à enrichir pour le checkout et le compte.

La build est générée dans `dist/frontend/browser`. Le serveur Node principal sert cette build lorsqu’elle existe, avec l’ancien `index.html` comme fallback local.

Les clés Stripe, PayPal, la base de données et les sessions restent gérées par le back-end Node/Express ; elles ne doivent jamais être copiées dans le front-end Angular.
