# AGENTS.md — DeckPilot

Guidance for agents (Claude, Codex, Coax) working in this repo. Humans: see `README.md`.

DeckPilot is an AI copilot for Magic: The Gathering Commander (EDH) deck building. Next.js 16 (App Router) + React 19 + TypeScript, Supabase (Postgres + Auth), Drizzle ORM, Inngest background jobs, and Anthropic + OpenAI via TanStack AI (streaming partial-JSON).

## Verify commands (run before claiming done)

Package manager is **pnpm**.

| Purpose | Command |
|---|---|
| Lint | `pnpm lint` |
| Type-check | `pnpm tsc --noEmit` (alias of `tsc -p tsconfig.json --noEmit`) |
| Unit tests | `pnpm test:unit` (Vitest, run-once) |
| E2E tests | `pnpm test:e2e` (Playwright) |
| Production build | `pnpm build` |
| Dev (app + Inngest) | `pnpm dev:all` |
| DB migrate / generate / studio | `pnpm db:migrate` · `pnpm db:generate` · `pnpm db:studio` |

A change is "done" only when `pnpm lint`, `pnpm tsc --noEmit`, and `pnpm test:unit` are green (and `pnpm build` for anything touching routing or the server/client boundary).

## Where things are not obvious

- `src/middleware.ts` is the auth perimeter. API routes in `publicApiRoutes` bypass it, so a new public route goes on that list and nothing else does.
- `src/app/global-error.tsx` is the only error boundary.
- AI prompts and zod schemas live in `src/lib/ai/`; responses stream as partial JSON through TanStack AI.
- Background jobs live in `src/lib/inngest/` and only run once registered in `src/app/api/inngest/route.ts`.

Conventions: Drizzle for all DB access over a direct service connection, so RLS is not a backstop and ownership has to be enforced in app code; Zod for validation at boundaries; TanStack AI for streaming; never commit `.env.local`; new DB changes need a journaled migration.

## Notion

Every write to Sean's Notion 🎯 Tasks goes through the `notion-task` skill (create, plan, start, ask, fail, hand back,
approved or sent back, carry-over). The rules are in `~/Development/hub/instructions/notion-tasks.md`. Where that path
doesn't exist (a cloud session), load the `notion-task` skill from Notion (`notion-get-enabled-skills`, then
`notion-download-skill`) and read https://app.notion.com/p/386f9f270555811bb12ce5bb3f2cb5e7; the hub file wins if they
disagree.

DeckPilot's project page is `385f9f27-0555-81b0-ae16-ea1f7a7369f8` (client go.digital). On Sean's machine, `.omc/notion-link.json` has the IDs and task defaults and `.omc/audit/synth.json`
has the audit backlog's acceptance criteria; neither is committed.
