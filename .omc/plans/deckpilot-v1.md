# DeckPilot — Implementation Plan v1

> AI copilot for Magic: The Gathering Commander deck building.
> "Archidekt meets AI copilot" — full deck management with an AI-powered recommendations panel.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 15 (App Router) | SSR, server components, streaming |
| Language | TypeScript (strict) | End-to-end type safety |
| Styling | Tailwind CSS v4 | Pairs with shadcn/ui, utility-first |
| Components | shadcn/ui (Radix primitives) | Copy-not-install model, full customization, accessible |
| Backend | Server Actions + Route Handlers | No tRPC overhead; native Next.js integration |
| ORM | Drizzle ORM + Drizzle Kit | Lightweight, SQL-like, fast serverless cold starts |
| Database | Supabase (PostgreSQL) | Managed Postgres, real-time capabilities |
| Auth | Supabase Auth | Email/password + Google/GitHub OAuth |
| Search | Supabase FTS (GIN index + prefix) | Fast typeahead over ~30k cards |
| AI | Vercel AI SDK (multi-provider) | Claude, OpenAI, others — user brings API keys |
| Server State | TanStack Query v5 | Caching, background refetch, optimistic updates |
| Client State | Zustand | UI-only state (panels, selections, drag) |
| Drag & Drop | dnd-kit | Modern, accessible, multi-container |
| Validation | Zod + react-hook-form | Runtime validation + form management |
| Charts | Recharts | Mana curve, card type distribution |
| URL State | nuqs | Shareable filter/search URLs |
| Unit Tests | Vitest | Fast, ESM-native, no extra config |
| E2E Tests | Playwright | Multi-browser, mobile emulation |
| Deployment | Vercel | Native Next.js hosting, edge functions |

---

## Data Sources

| Source | Type | Auth | Usage |
|--------|------|------|-------|
| **Scryfall** | Official public API | None (User-Agent header) | Card data, images, prices, bulk data sync |
| **EDHREC** | Unofficial JSON endpoints | None | Synergy scores, popular cards, salt scores, themes |
| **Archidekt** | Undocumented API | None (public decks) | User-initiated deck import only |
| **Moxfield** | Undocumented API | None (public decks) | User-initiated deck import only |

---

## Database Schema (Supabase/Drizzle)

### Core Tables

```
cards
├── id (uuid, PK)
├── scryfall_id (text, unique)
├── oracle_id (text, indexed)
├── name (text, indexed)
├── mana_cost (text)
├── cmc (numeric)
├── type_line (text)
├── oracle_text (text)
├── colors (text[])
├── color_identity (text[])
├── power (text)
├── toughness (text)
├── keywords (text[])
├── legalities (jsonb)
├── rarity (text)
├── set_code (text)
├── image_uris (jsonb)
├── prices (jsonb)
├── edhrec_rank (integer)
├── search_vector (tsvector, GIN indexed, generated)
├── synced_at (timestamptz)
└── raw_data (jsonb) -- full Scryfall response for future use

edhrec_commanders
├── id (uuid, PK)
├── card_id (uuid, FK → cards)
├── slug (text, unique, indexed)
├── synergy_data (jsonb) -- high synergy cards, top cards, categories
├── themes (jsonb)
├── avg_deck_size_stats (jsonb)
├── num_decks (integer)
├── cached_at (timestamptz)
└── expires_at (timestamptz) -- 24h TTL

edhrec_salt_scores
├── id (uuid, PK)
├── card_name (text, indexed)
├── salt_score (numeric)
├── cached_at (timestamptz)
└── expires_at (timestamptz)

profiles
├── id (uuid, PK, FK → auth.users)
├── display_name (text)
├── avatar_url (text)
├── ai_provider (text) -- 'anthropic', 'openai', etc.
├── ai_api_key_encrypted (text) -- encrypted, never exposed
├── default_bracket (integer, 1-4)
├── created_at (timestamptz)
└── updated_at (timestamptz)

playgroups
├── id (uuid, PK)
├── name (text)
├── owner_id (uuid, FK → profiles)
├── target_bracket (integer, 1-4)
├── max_salt_score (numeric, nullable)
├── house_rules (text, nullable)
├── banned_cards (text[], default '{}')
├── created_at (timestamptz)
└── updated_at (timestamptz)

playgroup_members
├── playgroup_id (uuid, FK → playgroups)
├── profile_id (uuid, FK → profiles)
├── role (text, 'owner' | 'member')
├── joined_at (timestamptz)
└── PK (playgroup_id, profile_id)

decks
├── id (uuid, PK)
├── owner_id (uuid, FK → profiles)
├── name (text)
├── description (text)
├── commander_id (uuid, FK → cards)
├── partner_id (uuid, FK → cards, nullable)
├── format (text, default 'commander')
├── target_bracket (integer, 1-4)
├── playgroup_id (uuid, FK → playgroups, nullable)
├── budget_limit_cents (integer, nullable)
├── total_price_cents (integer, computed)
├── is_public (boolean, default true)
├── import_source (text, nullable) -- 'archidekt', 'moxfield', 'text'
├── import_url (text, nullable)
├── created_at (timestamptz)
└── updated_at (timestamptz)

deck_cards
├── id (uuid, PK)
├── deck_id (uuid, FK → decks)
├── card_id (uuid, FK → cards)
├── quantity (integer, default 1)
├── category (text) -- 'creature', 'instant', 'land', 'ramp', etc.
├── is_commander (boolean, default false)
├── is_sideboard (boolean, default false)
├── user_note (text, nullable) -- 'always underperforms', 'pet card', etc.
├── added_at (timestamptz)
└── sort_order (integer)

deck_analyses
├── id (uuid, PK)
├── deck_id (uuid, FK → decks)
├── analysis_type (text) -- 'full', 'quick', 'swap_suggestion'
├── ai_provider (text)
├── ai_model (text)
├── prompt_tokens (integer)
├── completion_tokens (integer)
├── results (jsonb) -- structured analysis output
├── created_at (timestamptz)
└── status (text) -- 'pending', 'streaming', 'complete', 'failed'

swap_recommendations
├── id (uuid, PK)
├── analysis_id (uuid, FK → deck_analyses)
├── tier (text) -- 'must_cut', 'consider_cutting', 'must_add', 'consider_adding'
├── card_out_id (uuid, FK → cards, nullable) -- null for 'add' recommendations
├── card_in_id (uuid, FK → cards, nullable) -- null for 'cut' recommendations
├── reasoning (text)
├── synergy_score (numeric, nullable)
├── price_delta_cents (integer, nullable)
├── salt_delta (numeric, nullable)
├── sort_order (integer)
├── accepted (boolean, nullable) -- null=pending, true=accepted, false=rejected
└── created_at (timestamptz)

match_history
├── id (uuid, PK)
├── deck_id (uuid, FK → decks)
├── played_at (timestamptz)
├── result (text) -- 'win', 'loss', 'draw'
├── player_count (integer)
├── turn_count (integer, nullable)
├── notes (text, nullable) -- 'mana screwed', 'combo'd off turn 7', etc.
├── mvp_cards (uuid[], nullable) -- cards that performed well
├── underperformers (uuid[], nullable) -- cards that didn't pull weight
├── opponent_commanders (text[], nullable)
├── playgroup_id (uuid, FK → playgroups, nullable)
└── created_at (timestamptz)
```

### Row Level Security (RLS)
- `profiles`: Users can only read/write their own profile
- `decks`: Public decks readable by all; write restricted to owner
- `deck_cards`: Same as parent deck
- `playgroups`: Members can read; owner can write
- `match_history`: Owner can read/write; playgroup members can read

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Deck View   │  │   AI Panel   │  │   Chat Sidebar   │  │
│  │  (novel      │  │  (wizard/    │  │   (freeform      │  │
│  │   layout)    │  │   recs flow) │  │    discussion)   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │             │
│  ┌──────┴─────────────────┴────────────────────┴─────────┐  │
│  │              TanStack Query + Zustand                  │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
├─────────────────────────┼────────────────────────────────────┤
│                    SERVER                                     │
│                         │                                    │
│  ┌──────────────────────┴────────────────────────────────┐  │
│  │           Server Actions + Route Handlers              │  │
│  │                                                        │  │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────────────┐ │  │
│  │  │   Deck     │  │    AI      │  │   Import/       │ │  │
│  │  │   CRUD     │  │  Streaming │  │   Export        │ │  │
│  │  └─────┬──────┘  └─────┬──────┘  └───────┬─────────┘ │  │
│  └────────┼────────────────┼─────────────────┼───────────┘  │
│           │                │                 │               │
│  ┌────────┴────────────────┴─────────────────┴───────────┐  │
│  │                  Drizzle ORM                           │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
├─────────────────────────┼────────────────────────────────────┤
│                    DATA                                      │
│                         │                                    │
│  ┌──────────────────────┴────────────────────────────────┐  │
│  │               Supabase PostgreSQL                      │  │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌───────────┐ │  │
│  │  │  Cards  │ │  Decks   │ │  Users  │ │  EDHREC   │ │  │
│  │  │  (30k+) │ │          │ │         │ │  Cache    │ │  │
│  │  └─────────┘ └──────────┘ └─────────┘ └───────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              External APIs                               ││
│  │  Scryfall │ EDHREC │ Archidekt │ Moxfield │ AI Providers││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 0: Project Scaffolding & Infrastructure
**Goal:** Get the project running with all tooling configured.

| # | Task | Details |
|---|------|---------|
| 0.1 | Initialize Next.js 15 project | App Router, TypeScript strict, Tailwind v4, ESLint |
| 0.2 | Set up shadcn/ui | Install CLI, configure theme (clean/modern/minimal), add base components |
| 0.3 | Set up Supabase | Create project, configure environment variables, install client |
| 0.4 | Set up Drizzle ORM | Configure with Supabase connection, create initial schema, run first migration |
| 0.5 | Set up Vitest + Playwright | Configure test runners, add scripts to package.json |
| 0.6 | Set up Vercel deployment | Connect repo, configure env vars, verify preview deploys work |
| 0.7 | Configure project structure | Establish folder conventions (see below) |
| 0.8 | Set up CI | GitHub Actions: lint, type-check, test on PR |

**Folder Structure:**
```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Auth pages (login, register)
│   ├── (dashboard)/        # Authenticated pages
│   │   ├── decks/          # Deck list, deck detail, new deck
│   │   ├── playgroups/     # Playgroup management
│   │   ├── matches/        # Match history
│   │   └── settings/       # User settings, API keys
│   ├── api/                # Route Handlers
│   │   ├── ai/             # AI streaming endpoints
│   │   ├── import/         # Deck import endpoints
│   │   └── cards/          # Card search endpoints
│   ├── layout.tsx
│   └── page.tsx            # Landing page
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── deck/               # Deck-specific components
│   ├── cards/              # Card display components
│   ├── ai/                 # AI panel components
│   └── layout/             # Shell, nav, sidebar
├── lib/
│   ├── db/                 # Drizzle schema, migrations, queries
│   ├── ai/                 # AI provider config, prompts, tools
│   ├── scryfall/           # Scryfall API client + sync
│   ├── edhrec/             # EDHREC client + cache
│   ├── import/             # Archidekt/Moxfield import parsers
│   ├── export/             # Deck export formatters
│   ├── analysis/           # Deck analysis logic
│   └── utils/              # Shared utilities
├── hooks/                  # Custom React hooks
├── stores/                 # Zustand stores
├── types/                  # Shared TypeScript types
└── config/                 # App configuration
```

---

### Phase 1: Data Foundation
**Goal:** Card database populated and searchable.

| # | Task | Details |
|---|------|---------|
| 1.1 | Create Drizzle schema | All tables from schema section above |
| 1.2 | Run migrations | Push schema to Supabase |
| 1.3 | Build Scryfall sync service | Fetch bulk data (Oracle Cards), parse, upsert into `cards` table |
| 1.4 | Create FTS search vector | Generated `tsvector` column on cards (name + type_line + oracle_text), GIN index |
| 1.5 | Build card search API | Route handler with prefix search, debounced, returns card + image data |
| 1.6 | Build Scryfall price updater | Daily cron/scheduled function to refresh prices from Scryfall |
| 1.7 | Build EDHREC client | Fetch commander synergy data, cache in `edhrec_commanders` table (24h TTL) |
| 1.8 | Build EDHREC salt score sync | Fetch salt scores, cache in `edhrec_salt_scores` table |
| 1.9 | Build card image component | Next.js Image component wrapping Scryfall CDN URLs, lazy loading, blur placeholder |
| 1.10 | Seed data verification | Verify card count, search quality, image loading |

---

### Phase 2: Authentication & User Management
**Goal:** Users can sign up, log in, and manage their profile.

| # | Task | Details |
|---|------|---------|
| 2.1 | Configure Supabase Auth | Email/password + Google OAuth + GitHub OAuth |
| 2.2 | Build auth pages | Sign up, sign in, forgot password, email confirmation |
| 2.3 | Build auth middleware | Protect dashboard routes, redirect unauthenticated users |
| 2.4 | Build profile page | Display name, avatar, default bracket preference |
| 2.5 | Build settings page | AI provider selection, API key management (encrypted storage) |
| 2.6 | Set up RLS policies | Row-level security for all tables |

---

### Phase 3: Deck Management (CRUD)
**Goal:** Users can create, view, edit, and delete decks.

| # | Task | Details |
|---|------|---------|
| 3.1 | Build deck list page | Grid/list of user's decks with commander image, name, bracket, last updated |
| 3.2 | Build new deck flow | Name, commander picker (card search), format, bracket target |
| 3.3 | Build deck detail page (shell) | Layout with deck view area + side panels |
| 3.4 | Build card search + add | Typeahead search to add cards to deck, with quantity |
| 3.5 | Build card removal | Remove cards from deck |
| 3.6 | Build category management | Auto-categorize cards (creature, instant, land, etc.) + custom categories |
| 3.7 | Build deck stats bar | Card count, average CMC, color distribution, total price |
| 3.8 | Build deck settings | Edit name, description, bracket, budget, playgroup assignment |
| 3.9 | Build deck deletion | With confirmation |

---

### Phase 4: Novel Deck Layout
**Goal:** A visually distinctive, clean deck view that improves on the traditional card grid.

| # | Task | Details |
|---|------|---------|
| 4.1 | Design deck layout concept | Clean/modern/minimal. Consider: spatial/zoomable canvas, card clusters by function, mana curve as a visual element, commander as hero |
| 4.2 | Build commander hero section | Large commander card(s) as the visual anchor |
| 4.3 | Build card cluster view | Cards grouped by functional role (ramp, draw, removal, etc.) with visual distinction |
| 4.4 | Build mana curve visualization | Interactive Recharts bar chart showing CMC distribution |
| 4.5 | Build color pie chart | Color distribution donut/pie chart |
| 4.6 | Build card type breakdown | Visual breakdown of creatures/instants/sorceries/etc. |
| 4.7 | Build card hover preview | Full card image on hover, card details in a popover |
| 4.8 | Build drag-and-drop (dnd-kit) | Drag cards between categories, reorder within categories |
| 4.9 | Build responsive layout | Desktop: full layout. Tablet: collapsible panels. Mobile: swipeable views |
| 4.10 | Build light/dark mode | System preference detection + manual toggle |

---

### Phase 5: Deck Import & Export
**Goal:** Users can bring in existing decks and export finished ones.

| # | Task | Details |
|---|------|---------|
| 5.1 | Build text list parser | Parse MTGO/Arena format: "1 Card Name" or "1x Card Name (SET) #" |
| 5.2 | Build Archidekt import | Fetch from `archidekt.com/api/decks/{id}/`, map to local schema |
| 5.3 | Build Moxfield import | Fetch from `api2.moxfield.com/v3/decks/all/{id}`, map to local schema |
| 5.4 | Build import UI | Tabbed interface: paste URL or paste text list. Preview before confirming import |
| 5.5 | Build text list export | MTGO format, Arena format |
| 5.6 | Build CSV export | Full card data export |
| 5.7 | Build shareable link | Public deck URL with read-only view |
| 5.8 | Card matching/resolution | Fuzzy match pasted card names against local DB, handle ambiguity (show options) |

---

### Phase 6: AI Integration — Core
**Goal:** AI can analyze decks and provide recommendations.

| # | Task | Details |
|---|------|---------|
| 6.1 | Configure Vercel AI SDK | Multi-provider setup (Anthropic, OpenAI), API key routing per user |
| 6.2 | Build AI system prompt | Commander expertise prompt with deck analysis framework, power level awareness, salt awareness |
| 6.3 | Build deck context serializer | Convert deck + EDHREC data + user notes + match history into structured AI context |
| 6.4 | Build analysis streaming endpoint | Route Handler that streams AI analysis back to client |
| 6.5 | Build full deck analysis | Functional categories, mana base health, curve analysis, synergy scoring, dead card detection |
| 6.6 | Build analysis results UI | Structured display of analysis: strengths, weaknesses, scores per category |
| 6.7 | Store analysis results | Save to `deck_analyses` table for history |

---

### Phase 7: AI Integration — Recommendations
**Goal:** AI provides actionable swap recommendations with tiered priority.

| # | Task | Details |
|---|------|---------|
| 7.1 | Build swap recommendation engine | AI generates tiered suggestions (must cut / consider cutting / must add / consider adding) |
| 7.2 | Build recommendations UI | Tiered card lists with reasoning, EDHREC synergy data, price delta, salt delta |
| 7.3 | Build "find replacement" action | Click any card → AI suggests specific replacements with reasoning |
| 7.4 | Build accept/reject flow | User accepts or rejects each recommendation. Accepted swaps auto-apply to deck |
| 7.5 | Build budget-aware recommendations | AI respects deck budget constraint when suggesting swaps |
| 7.6 | Build bracket-aware recommendations | AI respects target power bracket, avoids over/under-powered suggestions |
| 7.7 | Build recommendation history | View past recommendation rounds, what was accepted/rejected |

---

### Phase 8: AI Integration — Chat Sidebar
**Goal:** Freeform AI discussion alongside the structured flow.

| # | Task | Details |
|---|------|---------|
| 8.1 | Build chat UI | Collapsible sidebar with message history, streaming responses |
| 8.2 | Build chat context | Chat has full deck context (same as analysis) + current recommendations state |
| 8.3 | Build card mentions | AI can mention cards in chat → rendered as interactive card links with hover preview |
| 8.4 | Build action suggestions | AI can suggest deck modifications from chat → user confirms to apply |
| 8.5 | Build conversation persistence | Save chat history per deck |

---

### Phase 9: New Deck Builder Flow
**Goal:** Users can start a new deck from either a theme/strategy or a commander.

| # | Task | Details |
|---|------|---------|
| 9.1 | Build entry point selector | "Start from a theme" or "Start from a commander" |
| 9.2 | Build theme browser | Popular Commander themes from EDHREC (aristocrats, voltron, blink, etc.) |
| 9.3 | Build commander suggestion | Given a theme → AI suggests commanders, with EDHREC popularity data |
| 9.4 | Build commander browser | Given "I want to pick a commander" → search/filter commanders by color, theme, style |
| 9.5 | Build strategy suggestion | Given a commander → AI proposes strategy approaches with EDHREC synergy data |
| 9.6 | Build auto-generate 99 | AI generates initial 99 cards for the chosen commander + strategy, respecting bracket/budget |
| 9.7 | Build review & refine | User reviews generated deck in the standard deck view, can immediately enter recommendation flow |

---

### Phase 10: Playgroup Features
**Goal:** Users can create and manage playgroups with shared context.

| # | Task | Details |
|---|------|---------|
| 10.1 | Build playgroup CRUD | Create, edit, delete playgroups |
| 10.2 | Build member management | Invite (by email/link), remove members, roles |
| 10.3 | Build playgroup settings | Target bracket, max salt score, house rules, banned cards list |
| 10.4 | Build playgroup deck calibration | When deck is assigned to a playgroup, AI factors in group's rules/bracket/banned cards |
| 10.5 | Build playgroup deck overview | View all members' decks in a playgroup, comparative power analysis |

---

### Phase 11: Match History & Annotations
**Goal:** Users can log games and annotate cards for richer AI context.

| # | Task | Details |
|---|------|---------|
| 11.1 | Build match logging UI | Quick-entry form: result, player count, turn count, notes |
| 11.2 | Build MVP/underperformer tagging | After a match, tag cards that over/under-performed |
| 11.3 | Build card annotation UI | On any card in deck view, add a note ("always underperforms", "pet card — keep") |
| 11.4 | Build match history view | Per-deck match log with win rate, trends |
| 11.5 | Build AI match context | Feed match history + annotations into AI analysis for more personalized recommendations |

---

### Phase 12: Polish & Launch Prep
**Goal:** Production-ready quality.

| # | Task | Details |
|---|------|---------|
| 12.1 | Performance optimization | Image lazy loading, virtual lists for large card sets, query caching tuning |
| 12.2 | Error handling & loading states | Skeleton loaders, error boundaries, toast notifications |
| 12.3 | SEO & meta tags | Open Graph for shared deck links, landing page SEO |
| 12.4 | Landing page | Marketing page explaining DeckPilot, sign-up CTA |
| 12.5 | Onboarding flow | First-time user guide: set up AI key, import first deck, run first analysis |
| 12.6 | Rate limiting & abuse prevention | API rate limits, AI usage caps per user tier |
| 12.7 | E2E test suite | Playwright tests for critical flows (import → analyze → accept swaps → export) |
| 12.8 | Accessibility audit | Keyboard navigation, screen reader testing, color contrast |
| 12.9 | Documentation | README, contributing guide, architecture docs |

---

## Phase Dependencies

```
Phase 0 (Scaffolding)
  └→ Phase 1 (Data Foundation)
       ├→ Phase 2 (Auth) ──→ Phase 3 (Deck CRUD)
       │                        ├→ Phase 4 (Deck Layout)
       │                        ├→ Phase 5 (Import/Export)
       │                        ├→ Phase 6 (AI Core) ──→ Phase 7 (AI Recs) ──→ Phase 8 (Chat)
       │                        └→ Phase 11 (Match History)
       └→ Phase 9 (New Deck Flow) -- depends on Phase 6

Phase 10 (Playgroups) -- depends on Phase 2 + Phase 3
Phase 12 (Polish) -- depends on all above
```

**Parallelizable phases:** After Phase 1+2+3, Phases 4, 5, 6, 10, and 11 can be worked on in parallel.

---

## MVP Scope (Phases 0–7)

The minimum viable product includes:
- Project setup and card database (Phases 0-1)
- Auth and user management (Phase 2)
- Deck CRUD with novel layout (Phases 3-4)
- Import/export (Phase 5)
- AI analysis and tiered recommendations (Phases 6-7)

**Post-MVP:** Chat sidebar (8), new deck builder (9), playgroups (10), match history (11), polish (12).

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| EDHREC endpoints change/break | Cache aggressively (24h), graceful degradation if unavailable, monitor for 404s |
| Archidekt/Moxfield block API access | Text list import as universal fallback, contact platforms for API access |
| Scryfall bulk data too large for Supabase free tier | Oracle Cards (~162MB JSON) fits; monitor row count. Consider Scryfall CDN for images (no storage needed) |
| AI token costs for full deck analysis | Show estimated cost before analysis, implement usage caps, cache repeated analyses |
| Card name ambiguity on import | Fuzzy matching with user disambiguation UI |
| Rate limits on Scryfall (10/sec) | Bulk data for local DB eliminates most live API calls; only prices need periodic refresh |

---

## Success Metrics

- **Time to analyze:** Import a deck and get AI analysis in < 30 seconds
- **Recommendation quality:** User accepts > 60% of AI swap suggestions
- **Completeness:** Analysis covers all functional categories (ramp, draw, removal, board wipes, win cons, protection)
- **Power calibration:** Recommendations stay within target bracket ± 0.5
