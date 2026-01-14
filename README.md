# d-translations-manager

A small, focused translations manager for next-intl projects.

This repository was created to solve a personal need: managing and editing next-intl translation JSON files more conveniently. It was also written as a capability test by the developer using Claude Code — the code for this project was produced entirely by Claude Code as part of that experiment.

> Note: This README documents the repository and the choices made during development. The code and scaffolding were created with Claude Code to explore how well an assistant can produce a complete Next.js + Prisma + client-side IndexedDB toolchain.

## What it does

- Import and manage master translation JSON files (next-intl style).
- Visualize the translation keys in a tree view and edit translations per language.
- Local-first: projects are stored in the browser using IndexedDB via `lib/storage.ts`.
- Optional cloud collaboration using Prisma/Postgres and invite codes to share projects with other users.
- Small utilities for exporting language-specific JSON files.
- Simple role-based sharing (owner/editor/viewer) using invite codes.

## Key features

- Local storage (IndexedDB) as the primary data store for fast offline editing.
- Cloud sync using a Postgres DB with Prisma for collaboration (invite codes and project sharing).
- Clean UI built with shadcn/ui components and a custom tree visualization for translations.
- Autosave and minimal re-renders (performance optimizations have been applied).
- Rename projects from the home screen (no need to open the editor for quick edits).

## Project layout

- `app/`, `components/` — Next.js app and React components
- `lib/` — client helpers (storage, API helpers, utils)
- `public/` — static assets
- `prisma/` — Prisma schema and generated client output (if configured)

Important files:
- `components/translation-manager.tsx` — main UI, project listing and editor
- `lib/storage.ts` — IndexedDB helpers and `saveProject` / `loadProject`
- `lib/api.ts` — network APIs used for cloud features

## Getting started (local dev)

1. Install dependencies (this project uses Bun/Node tooling in examples; adapt to npm/yarn if preferred):

```pwsh
# If you're using Bun (optional):
bun install

# Or with npm:
# npm install
```

2. Environment variables

- Create a `.env` file in the project root and set any required variables. For cloud collaboration you will likely need a `DATABASE_URL` for the Postgres database used by Prisma.

Example `.env` (edit to match your Postgres credentials):

```
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

3. Prisma (if using cloud collaboration)

```pwsh
# Generate Prisma client after editing schema
bunx prisma generate
# or
npx prisma generate
```

4. Start the dev server

```pwsh
bun run dev
# or
npm run dev
```

Open http://localhost:3000 to use the app.

## Notes on the cloud collaboration flow

- The cloud features are optional. The app works fully locally using IndexedDB (see `lib/storage.ts`).
- When you create or upload a project to the cloud, it becomes a cloud-backed project. Owners can create invite codes to allow other users to join the project with a role (editor/viewer).
- Invite codes are created in `components/collaboration/invite-codes-manager.tsx` and validated via the server API.

## How to rename a project quickly

- You can rename projects directly from the home screen. Hover a project in the `Recent Projects` list and click the pencil (rename) icon. That avoids having to open the editor and helps reduce perceived UI lag.

## Troubleshooting

- If you get runtime errors while starting the dev server, check the terminal output for missing environment variables or Prisma errors.
- If using cloud features, make sure `DATABASE_URL` is reachable and Prisma migrations (if any) have been applied.

## Contributing

- This project was written as a focused, personal tool and is intentionally minimal. If you'd like to contribute, open an issue or PR with small, self-contained changes.

## Credits

- Code authored by: Claude Code (the project was implemented completely by Claude Code as part of a capability test).

## License

MIT
