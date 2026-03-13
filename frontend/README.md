# Frontend Development

## Local Angular Dev Server

Run the Angular development server locally (no Docker required):

```bash
cd frontend
npm install
npm start
```

The app will be available at http://localhost:4200 with hot module replacement (HMR). Changes save and reload instantly.

**Note:** Run the local Docker stack as well if you want `/api` requests to resolve through the proxy config.

## Building for Production

To build the Angular app for production (used by Docker):

```bash
npm run build
```

Output is written to `frontend/dist/resume-website/browser/`.

## Sprint Times Grid

The sprint times table uses AG Grid Community and loads rows from:

- `GET /api/v1/sprints` for paginated/filterable/sortable rows

Frontend files:

- `src/app/components/sprint-times-grid/sprint-times-grid.component.ts`
- `src/app/services/sprint-api.service.ts`

## Routes

- `/` main portfolio page
- `/sprint` sprint leaderboard page
- `/photogallery` photo gallery page

A shared top navigation component (`src/app/components/top-nav/`) is rendered across pages.

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
