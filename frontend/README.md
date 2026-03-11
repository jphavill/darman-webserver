# Frontend Development

## Local Angular Dev Server

Run the Angular development server locally (no Docker required):

```bash
cd frontend
npm install
npm start
```

The app will be available at http://localhost:4200 with hot module replacement (HMR). Changes save and reload instantly.

**Note:** The backend and database are not available in this mode. API calls will fail unless you also run the backend separately or proxy to a staging environment.

## Building for Production

To build the Angular app for production (used by Docker):

```bash
npm run build
```

Output is written to `frontend/dist/resume-website/browser/`.

## Running Tests

Run the component/unit test suite once:

```bash
npm test
```

This runs `vitest run` with Angular `TestBed` setup in `src/test-setup.ts`.

If you want interactive watch mode while developing tests:

```bash
npm run test:watch
```
