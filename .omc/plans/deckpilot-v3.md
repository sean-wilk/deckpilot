# DeckPilot — Implementation Plan v3

> AI copilot for Magic: The Gathering Commander deck building.
> "Archidekt meets AI copilot" — full deck management with an AI-powered recommendations panel.

**Revision notes (v3):** Addresses v2 critic feedback. Key changes: resolved Inngest vs Trigger.dev (chose Inngest), fixed generateObject/streamObject usage, added super admin bootstrap, EDHREC rate limiting strategy, functional category targets for AI, env var inventory, connection pooler config, user flow walkthrough, Server Action vs Route Handler decision rule. **Additional v3 changes:** Supabase SSR auth architecture with `@supabase/ssr`, RLS policy SQL, app-level AES-256-GCM encryption (not Vault — free tier compatible), generated column SQL expressions, `card_type` derivation logic, task-level acceptance criteria for all MVP phases, per-phase testing strategy, integration wiring details (TanStack Query provider, Inngest function pattern, AI streaming pipeline with Route Handler paths and client consumption, Zustand store shape), test fixtures plan.

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
| Search | Supabase FTS (GIN index + prefix) | Fast typeahead over ~30k unique cards |
| AI | Vercel AI SDK (multi-provider) | Claude, OpenAI, others — platform keys with super admin config |
| Server State | TanStack Query v5 | Caching, background refetch, optimistic updates |
| Client State | Zustand | UI-only state (panels, selections, drag) |
| Drag & Drop | dnd-kit | Modern, accessible, multi-container |
| Validation | Zod + react-hook-form | Runtime validation + form management |
| Charts | Recharts | Mana curve, card type distribution |
| URL State | nuqs | Shareable filter/search URLs |
| Unit Tests | Vitest | Fast, ESM-native, no extra config |
| E2E Tests | Playwright | Multi-browser, mobile emulation |
| Deployment | Vercel | Native Next.js hosting, edge functions |
| Background Jobs | Inngest | Long-running Scryfall sync (exceeds Vercel 60s cron limit). Chose over Trigger.dev: better Vercel integration, simpler setup (single Route Handler), generous free tier (25k runs/month), built-in retries/throttling, event-driven model fits our use case. |
| Monitoring | Sentry | Error tracking, performance monitoring |

---

## Data Sources

| Source | Type | Auth | Usage |
|--------|------|------|-------|
| **Scryfall** | Official public API | None (User-Agent header) | Card data, images, prices, bulk data sync |
| **EDHREC** | Unofficial JSON endpoints | None | Synergy scores, popular cards, salt scores, themes |
| **Archidekt** | Undocumented API | None (public decks) | User-initiated deck import only (post-MVP) |
| **Moxfield** | Undocumented API | None (public decks) | User-initiated deck import only (post-MVP) |

### EDHREC Endpoint Reference

| Endpoint | Returns | Example |
|----------|---------|---------|
| `GET https://json.edhrec.com/pages/commanders/{slug}.json` | Full commander page: high-synergy cards, top cards, card categories, combos, deck stats, mana curve | `json.edhrec.com/pages/commanders/atraxa-praetors-voice.json` |
| `GET https://json.edhrec.com/pages/themes/{theme}.json` | Cards popular within a theme | `json.edhrec.com/pages/themes/aristocrats.json` |
| `GET https://json.edhrec.com/pages/top/month.json` | Most-played cards across all Commander decks this month | Paginated via `more` field |
| `GET https://json.edhrec.com/pages/salt.json` | Salt scores (most hated cards) | May require fallback approach if 403 |

**Slug format:** Lowercase hyphenated card name: `atraxa-praetors-voice`, `edgar-markov`, `the-ur-dragon`

**Commander endpoint card object fields:**
- `name`, `sanitized` (slug), `url`
- `synergy` — decimal 0.0–1.0, synergy strength above baseline
- `num_decks` / `inclusion` — raw count and percentage
- `potential_decks` — total decks of this commander analyzed
- `cmc`, `primary_type`, `rarity`, `type`, `layout`
- `prices` — multi-vendor
- `image_uris`, `scryfall_uri`
- `trend_zscore` — statistical trend indicator

**Card categories available:** `newcards`, `highsynergycards`, `topcards`, `gamechangers`, `creatures`, `instants`, `sorceries`, `utilityartifacts`, `enchantments`, `planeswalkers`, `lands`

**Fallback strategy:** If EDHREC is unavailable, the app functions with Scryfall data only. AI analysis proceeds without synergy data but notes the limitation. Salt scores default to null. Cached data is served even if expired (stale-while-revalidate pattern).

**EDHREC Rate Limiting Strategy:**
- **Max 1 request per second** to EDHREC endpoints (conservative, unofficial API)
- Implement a server-side request queue (simple in-memory queue with 1s spacing) for EDHREC fetches
- **Thundering herd prevention:** When a commander's cache expires, the first request triggers a refresh and sets a "refreshing" flag. Subsequent requests for the same commander during refresh serve stale cached data instead of triggering parallel fetches.
- **Cache TTL:** 24 hours from fetch time. Stale data served indefinitely as fallback.
- **Proactive refresh:** Inngest cron job refreshes the top 50 most-viewed commanders daily (overnight), so popular commanders rarely have cold caches.
- **Cold cache:** First request for an uncached commander fetches on-demand (user waits ~1-2s). Show loading state.

### Scryfall Attribution

Per Scryfall's terms and Wizards of the Coast Fan Content Policy:
- Must include Scryfall attribution in footer/about page
- Cannot paywall Scryfall data
- Cannot modify card images (crop, watermark, distort)
- Must "add value" beyond repackaging data
- Include WotC fan content disclaimer

---

## AI Architecture

### Provider Strategy

**Platform-provided keys** (not BYOK for MVP). AI API keys are managed server-side by the platform admin via a super admin panel. Users don't need their own keys.

- **Future:** BYOK as a "Pro" feature where users can use their own keys for unlimited usage
- **Vercel AI SDK** provides the abstraction layer — switching providers is a config change
- **Super admin panel** allows setting: default provider, default model per task type, API keys, usage limits
- **Super admin bootstrap:** First admin is set via env var `INITIAL_ADMIN_EMAIL`. On first login with that email, `is_super_admin` is automatically set to `true`. Subsequent admins are promoted via the admin panel by existing admins.

### Model Routing

| Task | Recommended Model | Est. Input Tokens | Est. Output Tokens | Est. Cost |
|------|-------------------|-------------------|--------------------|-----------|
| Full deck analysis | Claude Sonnet | ~15k | ~3k | ~$0.08 |
| Swap recommendations | Claude Sonnet | ~18k | ~4k | ~$0.11 |
| Find replacement (single card) | Claude Haiku | ~5k | ~1k | ~$0.01 |
| Chat message | Claude Sonnet | ~10k (with context) | ~1k | ~$0.05 |
| New deck generation | Claude Sonnet | ~8k | ~5k | ~$0.10 |

### Structured Output Strategy

Use **Vercel AI SDK's structured output functions with Zod schemas** for all AI responses. This provides:
- Type-safe structured output (no freeform text parsing)
- Automatic retry on malformed responses
- Schema validation at the SDK level

**Function selection rule:**

| Task | Function | Reason |
|------|----------|--------|
| Full deck analysis (6.4) | `streamObject()` | Large response, user sees progressive results |
| Swap recommendations (7.1) | `streamObject()` | Medium response, stream tiered results progressively |
| Find replacement (7.3) | `generateObject()` | Small response (<1k tokens), faster to wait for complete object |
| Chat messages (8.x) | `streamText()` | Freeform text, standard chat streaming |
| New deck generation (9.6) | `streamObject()` | Large response (99 cards), must stream |

**Rule of thumb:** Use `streamObject()` when output > ~1k tokens (user benefits from progressive rendering). Use `generateObject()` for small, fast responses. Use `streamText()` for freeform chat.

**Analysis output schema (Zod):**
```typescript
const DeckAnalysisSchema = z.object({
  overall_assessment: z.string(),
  power_level_estimate: z.object({
    bracket: z.number().min(1).max(4),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
  }),
  categories: z.object({
    ramp: z.object({ count: z.number(), target: z.number(), rating: z.enum(['deficient', 'low', 'adequate', 'strong', 'excessive']), cards: z.array(z.string()), notes: z.string() }),
    card_draw: z.object({ /* same shape */ }),
    removal: z.object({ /* same shape */ }),
    board_wipes: z.object({ /* same shape */ }),
    win_conditions: z.object({ /* same shape */ }),
    protection: z.object({ /* same shape */ }),
    lands: z.object({ /* same shape */ }),
  }),
  mana_base: z.object({
    land_count: z.number(),
    recommended_land_count: z.number(),
    color_balance: z.record(z.string(), z.number()), // { W: 12, U: 8, ... }
    color_pip_requirements: z.record(z.string(), z.number()),
    fixing_quality: z.enum(['poor', 'fair', 'good', 'excellent']),
    notes: z.string(),
  }),
  synergy: z.object({
    score: z.number().min(0).max(10),
    key_synergies: z.array(z.object({ cards: z.array(z.string()), description: z.string() })),
    dead_cards: z.array(z.object({ card: z.string(), reasoning: z.string() })),
    detected_combos: z.array(z.object({ cards: z.array(z.string()), description: z.string(), is_infinite: z.boolean() })),
  }),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  salt_assessment: z.object({
    total_salt: z.number(),
    high_salt_cards: z.array(z.object({ card: z.string(), salt_score: z.number() })),
    notes: z.string(),
  }),
})

const SwapRecommendationSchema = z.object({
  recommendations: z.array(z.object({
    tier: z.enum(['must_cut', 'consider_cutting', 'must_add', 'consider_adding']),
    card_out: z.string().nullable(),
    card_in: z.string().nullable(),
    reasoning: z.string(),
    impact_summary: z.string(), // one-line impact
    tags: z.array(z.enum(['synergy', 'mana_fix', 'power_level', 'budget', 'salt_reduction', 'curve'])),
  })),
  summary: z.string(),
  estimated_bracket_after: z.number().min(1).max(4),
  estimated_price_delta_cents: z.number(),
})
```

### Context Window Budget

**Hard limit: 25k input tokens per request.** Strategy for fitting deck context:

| Context Element | Token Budget | Strategy |
|-----------------|-------------|----------|
| System prompt | ~2k | Static, cached |
| Card list (99 cards) | ~8k | Name + CMC + type + key abilities only (not full oracle text) |
| EDHREC synergy data | ~3k | Top 20 high-synergy, top 10 low-synergy only |
| User annotations | ~1k | Only cards with notes |
| Match history | ~1k | Last 10 matches, summarized |
| Constraints (bracket, budget, salt) | ~0.5k | Structured |
| Reserve for nuance | ~9.5k | Available for additional card details if needed |

**Overflow strategy:** If context exceeds 25k tokens, progressively trim: match history → EDHREC data → card details (keep name + type only).

### AI Error Handling

| Error | Handling |
|-------|---------|
| 429 Rate Limited | Exponential backoff (1s, 2s, 4s), max 3 retries. Show "AI is busy, retrying..." |
| 401 Invalid Key | Admin notification. Users see "AI temporarily unavailable." |
| 500 Provider Error | Failover to secondary provider if configured. Show "Analysis failed, try again." |
| Malformed Output | Vercel AI SDK auto-retries with `generateObject`. Max 2 retries. |
| Context Too Large | Progressive trimming (see overflow strategy above) |
| Timeout (>30s) | Cancel stream, show partial results if available, offer retry |

### Prompt Framework

System prompt structure:
1. **Role:** Expert MTG Commander deck builder and analyst
2. **Knowledge:** Commander rules, bracket system (1-4), salt scoring, meta awareness
3. **Constraints:** Target bracket, budget limit, banned cards, playgroup rules
4. **Context:** Current deck list, EDHREC synergy data, user annotations, match history
5. **Task:** Specific analysis or recommendation request
6. **Output format:** Zod schema definition (enforced by `generateObject`/`streamObject`)

### Functional Category Targets

These are the baseline targets the AI uses when evaluating a Commander deck. Injected into the system prompt.

| Category | Target Count | Notes |
|----------|-------------|-------|
| **Ramp** (mana acceleration) | 10–12 | Sol Ring, signets, mana dorks, land ramp spells |
| **Card Draw** | 10–12 | Includes cantrips, engines, and one-shot draw |
| **Targeted Removal** | 7–10 | Single-target creature, artifact, enchantment removal |
| **Board Wipes** | 2–4 | Mass removal (creatures, artifacts, all permanents) |
| **Win Conditions** | 3–5 | Cards that can close out the game (combos, finishers, overwhelming board states) |
| **Protection/Interaction** | 3–5 | Counterspells, hexproof granters, indestructible, phasing |
| **Lands** | 35–38 | Adjust down by 1 for each 2 mana-positive rocks/dorks beyond 10 ramp sources |
| **Standalone Utility** | Flex | Tutors, recursion, graveyard hate, etc. — varies by strategy |

**Bracket adjustments:**
- Bracket 1 (precon-level): Lower ramp/draw targets (8-10 each), fewer tutors, no infinite combos
- Bracket 2 (casual): Targets as listed above
- Bracket 3 (focused): Can push ramp/draw to 12-14, more tutors allowed, efficient combos OK
- Bracket 4 (competitive/cEDH): Maximize efficiency, fast mana, compact combo lines, 28-32 lands

These targets are guidelines, not hard rules. The AI should explain deviations based on the commander's specific strategy (e.g., a lands-matter deck may run 40+ lands and less ramp).

---

## Operational Details

### Server Action vs Route Handler Decision Rule

| Pattern | Use | Reason |
|---------|-----|--------|
| Mutations from forms (create deck, save settings, accept swap) | **Server Action** | Native form integration, progressive enhancement, revalidation |
| Data fetching in Server Components | **Direct Drizzle queries** | No network hop, server-only |
| AI streaming responses | **Route Handler** | Vercel AI SDK requires `Response` streaming |
| Card search typeahead | **Route Handler** | Client-initiated, debounced, JSON API |
| Deck import (URL fetch) | **Route Handler** | External API calls, longer execution |
| Inngest webhook | **Route Handler** | `/api/inngest` webhook endpoint |

**Rule of thumb:** If it's a form submission or button-triggered mutation → Server Action. If it streams, serves JSON to a client fetch, or talks to external APIs → Route Handler.

### Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=           # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Supabase anonymous key (public, for client)
SUPABASE_SERVICE_ROLE_KEY=          # Supabase service role key (server-only, for admin ops)
DATABASE_URL=                       # Supabase connection pooler URI (session mode, for Drizzle)

# Auth
INITIAL_ADMIN_EMAIL=                # Email auto-promoted to super admin on first login

# Encryption
ENCRYPTION_KEY=                     # 32-byte hex key for AES-256-GCM encryption of API keys in DB. Generate with: openssl rand -hex 32

# AI Providers (managed via admin panel, stored in DB — these are fallback/initial setup)
ANTHROPIC_API_KEY=                  # Initial Anthropic API key (seeded to admin_ai_config on first run)
OPENAI_API_KEY=                     # Initial OpenAI API key (optional, seeded to admin_ai_config)

# Inngest
INNGEST_EVENT_KEY=                  # Inngest event key
INNGEST_SIGNING_KEY=                # Inngest webhook signing key

# Monitoring
SENTRY_DSN=                         # Sentry error tracking
NEXT_PUBLIC_SENTRY_DSN=             # Sentry client-side (public)

# App
NEXT_PUBLIC_APP_URL=                # Public app URL (for shareable links, OAuth redirects)
```

### Supabase Connection Pooler

Use **Supavisor in session mode** (port 5432) for the `DATABASE_URL`. Session mode supports prepared statements, which Drizzle uses by default. Transaction mode (port 6543) does NOT support prepared statements and would require `prepare: false` in Drizzle config.

If connection limits become an issue on Supabase free tier (limited to ~20 direct connections), switch to transaction mode with `prepare: false` in Drizzle config.

### User Flow Walkthrough (MVP)

**Existing deck improvement (primary flow):**
1. User signs up / logs in
2. User clicks "New Deck" → enters name, searches and selects commander, sets target bracket
3. User clicks "Import" → pastes deck list in MTGO/Arena format
4. App matches card names, shows preview with any unresolved cards → user confirms
5. Deck view shows cards in standard grid, stats bar shows card count/CMC/colors/price
6. User clicks "Analyze Deck" in the AI panel → AI streams structured analysis (strengths, weaknesses, category ratings, mana base, synergy, salt)
7. User clicks "Get Recommendations" → AI streams tiered swap suggestions (must cut, consider cutting, must add, consider adding)
8. User reviews each recommendation (card image, reasoning, price/salt delta) → accepts or rejects
9. Accepted swaps auto-apply to deck, version snapshot created
10. User can run analysis again, get more recommendations, or export the deck as text list

**New deck from scratch (post-MVP):**
1. User picks "Build New Deck" → chooses theme or commander
2. AI suggests commanders (if theme-first) or strategies (if commander-first)
3. AI generates initial 99 → user enters the standard deck view + recommendation flow

---

## Card Data Strategy

### Reprints & Deduplication

MTG cards are reprinted across many sets. Strategy:

- **`cards` table stores one row per unique card** using Scryfall's `oracle_id` as the deduplication key
- Use Scryfall **Oracle Cards** bulk data (one entry per unique card, ~30k rows) — NOT Default Cards (500k+ rows with every printing)
- `scryfall_id` is the ID of the "preferred" printing (Scryfall picks the best one)
- `image_uris` stores the preferred printing's images
- `set_code` stores the preferred printing's set
- `prices` stores the cheapest available printing's prices (user cares about cheapest, not specific printing)
- **Search returns unique cards** — user never sees 50 results for "Sol Ring"

### Dual-Faced Cards (DFCs), Split Cards, Adventures

Scryfall represents these differently:

| Card Type | `image_uris` Location | `card_faces` | Example |
|-----------|----------------------|--------------|---------|
| Normal | Top-level `image_uris` | None | Lightning Bolt |
| Transform DFC | `card_faces[0].image_uris`, `card_faces[1].image_uris` | 2 faces | Delver of Secrets |
| Modal DFC (MDFC) | `card_faces[0].image_uris`, `card_faces[1].image_uris` | 2 faces | Emeria's Call |
| Split | Top-level `image_uris` | 2 faces (shared image) | Fire // Ice |
| Adventure | Top-level `image_uris` | 2 faces (shared image) | Bonecrusher Giant |
| Flip | Top-level `image_uris` | 2 faces (shared image) | Erayo |

**Implementation:**
- `image_uris (jsonb)` stores top-level image URIs for normal/split/adventure cards
- `card_faces (jsonb)` stores the full `card_faces` array from Scryfall for DFCs
- Card image component checks: if `card_faces` exists and has per-face `image_uris`, render a flippable card. Otherwise use top-level `image_uris`.
- `oracle_text` concatenates all faces' text for search
- `name` stores the full name (e.g., "Delver of Secrets // Insectile Aberration")
- `type_line` stores the front face type line

### Commander Variant Support

| Variant | Schema Support |
|---------|---------------|
| Single commander | `decks.commander_id` |
| Partner | `decks.commander_id` + `decks.partner_id` |
| Partner With | Same as Partner (specific pairings enforced at app level) |
| Friends Forever | Same as Partner |
| Choose a Background | `commander_id` = creature, `partner_id` = Background enchantment |
| Doctor's Companion | Same as Partner |
| Companion (from sideboard) | Stored in `deck_cards` with `is_companion = true` |

---

## Database Schema (Supabase/Drizzle)

### Core Tables

```
cards
├── id (uuid, PK)
├── scryfall_id (text, unique)
├── oracle_id (text, unique) -- deduplication key, one row per unique card
├── name (text)
├── mana_cost (text, nullable) -- null for lands
├── cmc (numeric)
├── type_line (text)
├── oracle_text (text, nullable)
├── colors (text[])
├── color_identity (text[])
├── power (text, nullable)
├── toughness (text, nullable)
├── keywords (text[])
├── legalities (jsonb)
├── rarity (text)
├── set_code (text) -- preferred printing
├── image_uris (jsonb, nullable) -- null for DFCs (use card_faces)
├── card_faces (jsonb, nullable) -- array of face objects for DFCs/split/adventure
├── prices (jsonb) -- cheapest printing prices
├── edhrec_rank (integer, nullable)
├── is_commander_legal (boolean, generated) -- derived from legalities
├── search_vector (tsvector, GIN indexed, generated from name + type_line + oracle_text)
├── synced_at (timestamptz)
├── INDEX idx_cards_name ON (name)
├── INDEX idx_cards_color_identity ON (color_identity) USING GIN
├── INDEX idx_cards_cmc ON (cmc)
└── INDEX idx_cards_commander_legal ON (is_commander_legal) WHERE is_commander_legal = true

edhrec_commanders
├── id (uuid, PK)
├── card_id (uuid, FK → cards, unique)
├── slug (text, unique)
├── synergy_data (jsonb) -- { highsynergycards: [...], topcards: [...], ... }
├── themes (jsonb) -- available themes for this commander
├── avg_deck_stats (jsonb) -- average CMC, land count, creature count, etc.
├── num_decks (integer)
├── cached_at (timestamptz)
├── expires_at (timestamptz) -- 24h TTL
├── INDEX idx_edhrec_slug ON (slug)
└── INDEX idx_edhrec_expires ON (expires_at)

edhrec_salt_scores
├── id (uuid, PK)
├── card_id (uuid, FK → cards, unique) -- FK instead of name
├── salt_score (numeric)
├── cached_at (timestamptz)
└── INDEX idx_salt_card ON (card_id)

profiles
├── id (uuid, PK, FK → auth.users)
├── display_name (text)
├── avatar_url (text, nullable)
├── default_bracket (integer, 1-4, default 2)
├── is_super_admin (boolean, default false)
├── created_at (timestamptz)
├── updated_at (timestamptz)
└── INDEX idx_profiles_admin ON (is_super_admin) WHERE is_super_admin = true

admin_ai_config
├── id (uuid, PK)
├── provider (text) -- 'anthropic', 'openai', etc.
├── model_analysis (text) -- model ID for deck analysis
├── model_recommendations (text) -- model ID for swap recs
├── model_chat (text) -- model ID for chat
├── model_generation (text) -- model ID for deck generation
├── api_key_encrypted (text) -- encrypted via app-level AES-256-GCM using ENCRYPTION_KEY env var
├── is_active (boolean, default true)
├── usage_limit_daily_cents (integer, nullable) -- daily spend cap
├── created_at (timestamptz)
└── updated_at (timestamptz)

playgroups
├── id (uuid, PK)
├── name (text)
├── owner_id (uuid, FK → profiles)
├── target_bracket (integer, 1-4)
├── max_salt_score (numeric, nullable)
├── house_rules (text, nullable)
├── banned_cards (uuid[], default '{}') -- FK references to cards table
├── created_at (timestamptz)
├── updated_at (timestamptz)
└── INDEX idx_playgroups_owner ON (owner_id)

playgroup_members
├── playgroup_id (uuid, FK → playgroups)
├── profile_id (uuid, FK → profiles)
├── role (text, CHECK role IN ('owner', 'member'))
├── joined_at (timestamptz)
└── PK (playgroup_id, profile_id)

decks
├── id (uuid, PK)
├── owner_id (uuid, FK → profiles)
├── name (text)
├── description (text, nullable)
├── commander_id (uuid, FK → cards)
├── partner_id (uuid, FK → cards, nullable)
├── format (text, default 'commander')
├── target_bracket (integer, 1-4)
├── playgroup_id (uuid, FK → playgroups, nullable)
├── budget_limit_cents (integer, nullable)
├── is_public (boolean, default true)
├── import_source (text, nullable) -- 'archidekt', 'moxfield', 'text'
├── import_url (text, nullable)
├── created_at (timestamptz)
├── updated_at (timestamptz)
├── INDEX idx_decks_owner ON (owner_id)
└── INDEX idx_decks_public ON (is_public) WHERE is_public = true

deck_cards
├── id (uuid, PK)
├── deck_id (uuid, FK → decks ON DELETE CASCADE)
├── card_id (uuid, FK → cards)
├── quantity (integer, default 1, CHECK quantity > 0)
├── card_type (text) -- auto-derived from card data: 'creature', 'instant', 'sorcery', etc.
├── functional_role (text, nullable) -- user/AI assigned: 'ramp', 'card_draw', 'removal', 'win_con', etc.
├── is_commander (boolean, default false)
├── is_companion (boolean, default false)
├── is_sideboard (boolean, default false)
├── user_note (text, nullable)
├── added_at (timestamptz)
├── sort_order (integer)
├── INDEX idx_deck_cards_deck ON (deck_id)
└── UNIQUE (deck_id, card_id) -- prevent duplicate entries

deck_versions
├── id (uuid, PK)
├── deck_id (uuid, FK → decks ON DELETE CASCADE)
├── version_number (integer)
├── snapshot (jsonb) -- full deck state: card list + settings
├── change_summary (text) -- "Accepted 5 AI recommendations", "Manual edit: added Sol Ring"
├── created_at (timestamptz)
├── INDEX idx_deck_versions_deck ON (deck_id)
└── UNIQUE (deck_id, version_number)

deck_analyses
├── id (uuid, PK)
├── deck_id (uuid, FK → decks ON DELETE CASCADE)
├── deck_version_id (uuid, FK → deck_versions, nullable)
├── analysis_type (text) -- 'full', 'quick', 'swap_suggestion', 'find_replacement'
├── ai_provider (text)
├── ai_model (text)
├── prompt_tokens (integer)
├── completion_tokens (integer)
├── cost_cents (integer) -- tracked for admin dashboard
├── results (jsonb) -- structured analysis matching Zod schema
├── status (text, CHECK status IN ('pending', 'streaming', 'complete', 'failed'))
├── error_message (text, nullable)
├── created_at (timestamptz)
└── INDEX idx_analyses_deck ON (deck_id)

swap_recommendations
├── id (uuid, PK)
├── analysis_id (uuid, FK → deck_analyses ON DELETE CASCADE)
├── tier (text, CHECK tier IN ('must_cut', 'consider_cutting', 'must_add', 'consider_adding'))
├── card_out_id (uuid, FK → cards, nullable)
├── card_in_id (uuid, FK → cards, nullable)
├── reasoning (text)
├── impact_summary (text)
├── tags (text[]) -- ['synergy', 'mana_fix', 'power_level', 'budget', 'salt_reduction', 'curve']
├── synergy_score (numeric, nullable)
├── price_delta_cents (integer, nullable)
├── salt_delta (numeric, nullable)
├── sort_order (integer)
├── accepted (boolean, nullable) -- null=pending, true=accepted, false=rejected
├── created_at (timestamptz)
├── INDEX idx_swaps_analysis ON (analysis_id)
└── CHECK (card_out_id IS NOT NULL OR card_in_id IS NOT NULL) -- at least one must be set

match_history
├── id (uuid, PK)
├── deck_id (uuid, FK → decks ON DELETE CASCADE)
├── played_at (timestamptz)
├── result (text, CHECK result IN ('win', 'loss', 'draw'))
├── player_count (integer, CHECK player_count >= 2)
├── turn_count (integer, nullable)
├── notes (text, nullable)
├── opponent_commanders (text[], nullable)
├── playgroup_id (uuid, FK → playgroups, nullable)
├── created_at (timestamptz)
└── INDEX idx_matches_deck ON (deck_id)

match_card_performance
├── id (uuid, PK)
├── match_id (uuid, FK → match_history ON DELETE CASCADE)
├── card_id (uuid, FK → cards)
├── performance (text, CHECK performance IN ('mvp', 'underperformer'))
├── note (text, nullable)
└── INDEX idx_match_cards_match ON (match_id)
```

### Row Level Security (RLS) — Policy SQL

```sql
-- profiles: users read/write own profile, super admin reads all
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Super admin can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- admin_ai_config: super admin only
ALTER TABLE admin_ai_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin full access" ON admin_ai_config FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
);

-- decks: public decks readable by all, write restricted to owner
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public decks readable by all" ON decks FOR SELECT USING (is_public = true);
CREATE POLICY "Owners can view own decks" ON decks FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Owners can insert decks" ON decks FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update own decks" ON decks FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owners can delete own decks" ON decks FOR DELETE USING (owner_id = auth.uid());

-- deck_cards: join to decks to check owner (NOT "inherits" — explicit policy required)
ALTER TABLE deck_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read deck cards if deck is public or owned" ON deck_cards FOR SELECT USING (
  EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_cards.deck_id AND (decks.is_public = true OR decks.owner_id = auth.uid()))
);
CREATE POLICY "Modify deck cards if deck is owned" ON deck_cards FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_cards.deck_id AND decks.owner_id = auth.uid())
);
CREATE POLICY "Update deck cards if deck is owned" ON deck_cards FOR UPDATE USING (
  EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_cards.deck_id AND decks.owner_id = auth.uid())
);
CREATE POLICY "Delete deck cards if deck is owned" ON deck_cards FOR DELETE USING (
  EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_cards.deck_id AND decks.owner_id = auth.uid())
);

-- deck_versions: same join pattern as deck_cards
ALTER TABLE deck_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read versions if deck is public or owned" ON deck_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_versions.deck_id AND (decks.is_public = true OR decks.owner_id = auth.uid()))
);
CREATE POLICY "Write versions if deck is owned" ON deck_versions FOR ALL USING (
  EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_versions.deck_id AND decks.owner_id = auth.uid())
);

-- cards, edhrec_*: public read, system-only write (via service role key)
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cards" ON cards FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policies — only service role key can write

ALTER TABLE edhrec_commanders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read edhrec data" ON edhrec_commanders FOR SELECT USING (true);

ALTER TABLE edhrec_salt_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read salt scores" ON edhrec_salt_scores FOR SELECT USING (true);

-- playgroups: members can read, owner can write
ALTER TABLE playgroups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view playgroup" ON playgroups FOR SELECT USING (
  EXISTS (SELECT 1 FROM playgroup_members WHERE playgroup_members.playgroup_id = playgroups.id AND playgroup_members.profile_id = auth.uid())
);
CREATE POLICY "Owner can manage playgroup" ON playgroups FOR ALL USING (owner_id = auth.uid());

-- deck_analyses: same pattern as deck_cards (join to decks for ownership)
ALTER TABLE deck_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read analyses if deck is public or owned" ON deck_analyses FOR SELECT USING (
  EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_analyses.deck_id AND (decks.is_public = true OR decks.owner_id = auth.uid()))
);
CREATE POLICY "Write analyses if deck is owned" ON deck_analyses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_analyses.deck_id AND decks.owner_id = auth.uid())
);

-- swap_recommendations: cascades through deck_analyses
ALTER TABLE swap_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read swaps if analysis deck is public or owned" ON swap_recommendations FOR SELECT USING (
  EXISTS (SELECT 1 FROM deck_analyses JOIN decks ON decks.id = deck_analyses.deck_id
    WHERE deck_analyses.id = swap_recommendations.analysis_id AND (decks.is_public = true OR decks.owner_id = auth.uid()))
);
CREATE POLICY "Write swaps if analysis deck is owned" ON swap_recommendations FOR ALL USING (
  EXISTS (SELECT 1 FROM deck_analyses JOIN decks ON decks.id = deck_analyses.deck_id
    WHERE deck_analyses.id = swap_recommendations.analysis_id AND decks.owner_id = auth.uid())
);

-- match_history: owner can read/write, playgroup members can read
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can manage match history" ON match_history FOR ALL USING (
  EXISTS (SELECT 1 FROM decks WHERE decks.id = match_history.deck_id AND decks.owner_id = auth.uid())
);
CREATE POLICY "Playgroup members can view matches" ON match_history FOR SELECT USING (
  match_history.playgroup_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM playgroup_members WHERE playgroup_members.playgroup_id = match_history.playgroup_id AND playgroup_members.profile_id = auth.uid()
  )
);
```

### API Key Encryption

**Approach:** App-level AES-256-GCM (not Supabase Vault — Vault requires Pro plan, we target free tier).

- **Encryption key:** `ENCRYPTION_KEY` env var, 32-byte hex string. Generated via `openssl rand -hex 32`.
- **Encrypt on write:** When admin saves an API key, encrypt with AES-256-GCM before storing in `admin_ai_config.api_key_encrypted`.
- **Decrypt on read:** When AI endpoint needs the key, decrypt server-side. Key is NEVER sent to client.
- **Format:** Store as `iv:ciphertext:authTag` (all hex-encoded) in a single text column.
- **Helper location:** `src/lib/encryption.ts` — exports `encrypt(plaintext)` and `decrypt(ciphertext)`.
- **Key rotation:** Not needed for MVP. Future: re-encrypt all keys when `ENCRYPTION_KEY` changes.

### Generated Column Expressions

```sql
-- is_commander_legal: derived from legalities JSONB
ALTER TABLE cards ADD COLUMN is_commander_legal boolean
  GENERATED ALWAYS AS ((legalities->>'commander') = 'legal') STORED;

-- search_vector: full-text search using 'simple' config (no stemming — better for fantasy card names)
ALTER TABLE cards ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(type_line, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(oracle_text, '')), 'C')
  ) STORED;

CREATE INDEX idx_cards_search ON cards USING GIN (search_vector);
```

**Why `'simple'` config:** MTG card names include fantasy words (Thragtusk, Aetherflux), non-English terms, and ability keywords that English stemming would mangle. `'simple'` tokenizes on whitespace/punctuation without stemming, giving better exact-prefix matching for card search typeahead.

### card_type Assignment

`deck_cards.card_type` is set via application code on INSERT, derived from the referenced card's `type_line`:

```typescript
function deriveCardType(typeLine: string): string {
  const lower = typeLine.toLowerCase();
  if (lower.includes('land')) return 'land';
  if (lower.includes('creature')) return 'creature';
  if (lower.includes('instant')) return 'instant';
  if (lower.includes('sorcery')) return 'sorcery';
  if (lower.includes('artifact')) return 'artifact';
  if (lower.includes('enchantment')) return 'enchantment';
  if (lower.includes('planeswalker')) return 'planeswalker';
  if (lower.includes('battle')) return 'battle';
  return 'other';
}
```

Priority order matters: "Artifact Creature" → creature (creatures are more relevant for Commander categorization). This is set once on add and does not change.

### Migration Strategy
- **Drizzle Kit** manages schema migrations via `drizzle-kit generate` (creates SQL migration files)
- Migration files committed to git in `src/lib/db/migrations/`
- `drizzle-kit push` for rapid local dev iteration
- `drizzle-kit migrate` for production deployments (via CI/CD)
- Supabase's built-in migration system is NOT used — Drizzle is the single source of truth
- Vercel preview deploys use a shared Supabase staging database

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Deck View   │  │   AI Panel   │  │   Chat Sidebar   │  │
│  │  (standard   │  │  (wizard/    │  │   (freeform      │  │
│  │   grid, MVP) │  │   recs flow) │  │    discussion)   │  │
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
│  │  │  (30k)  │ │ +Versions│ │ +Admin  │ │  Cache    │ │  │
│  │  └─────────┘ └──────────┘ └─────────┘ └───────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────┐  ┌────────────────────────┐  │
│  │    External APIs         │  │  Background Jobs       │  │
│  │  Scryfall │ EDHREC       │  │  Inngest   │  │
│  │  AI Providers             │  │  Scryfall sync, prices │  │
│  └──────────────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Wiring Details

### TanStack Query Setup

Add to Phase 0. Create `src/components/providers.tsx`:

```typescript
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  }))
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

Wrap in `src/app/layout.tsx`. Server Components fetch data directly via Drizzle (no TanStack Query needed). Client Components use `useQuery`/`useMutation` for interactive operations (deck card add/remove, search typeahead, etc.).

### Inngest Function Pattern

`src/lib/inngest/client.ts`:
```typescript
import { Inngest } from 'inngest'
export const inngest = new Inngest({ id: 'deckpilot' })
```

`src/lib/inngest/functions/sync-cards.ts`:
```typescript
import { inngest } from '../client'
export const syncCards = inngest.createFunction(
  { id: 'sync-scryfall-cards', retries: 3 },
  { cron: '0 3 * * *' }, // daily 3 AM UTC
  async ({ step }) => {
    const bulkUrl = await step.run('get-bulk-url', async () => { /* fetch scryfall bulk-data API */ })
    await step.run('download-and-upsert', async () => { /* stream-parse and batch upsert */ })
  }
)
```

`src/app/api/inngest/route.ts`:
```typescript
import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { syncCards } from '@/lib/inngest/functions/sync-cards'
export const { GET, POST, PUT } = serve({ client: inngest, functions: [syncCards] })
```

### AI Streaming Pipeline

**Route Handler paths:**

| Endpoint | File | Function | Client Consumption |
|----------|------|----------|--------------------|
| `POST /api/ai/analyze` | `src/app/api/ai/analyze/route.ts` | `streamObject()` with `DeckAnalysisSchema` | `useObject()` from `ai/react` |
| `POST /api/ai/recommend` | `src/app/api/ai/recommend/route.ts` | `streamObject()` with `SwapRecommendationSchema` | `useObject()` from `ai/react` |
| `POST /api/ai/find-replacement` | `src/app/api/ai/find-replacement/route.ts` | `generateObject()` with `ReplacementSchema` | `useMutation()` from TanStack Query |
| `POST /api/ai/chat` | `src/app/api/ai/chat/route.ts` | `streamText()` | `useChat()` from `ai/react` |

**Auth in Route Handlers:** Every AI Route Handler starts with:
```typescript
const supabase = createClient() // from src/lib/supabase/server.ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

**Provider config loading:** Cache the active `admin_ai_config` in memory with 5-minute TTL (simple `Map` with timestamp). Invalidate on admin panel save. Avoids DB query on every AI request.

### Zustand Store Shape

```typescript
// src/stores/ui-store.ts
interface UIState {
  // Panel visibility
  aiPanelOpen: boolean
  chatSidebarOpen: boolean
  toggleAiPanel: () => void
  toggleChatSidebar: () => void

  // Card selection (for bulk operations)
  selectedCardIds: Set<string>
  toggleCardSelection: (id: string) => void
  clearSelection: () => void

  // Deck view mode
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void

  // Card hover preview
  hoveredCardId: string | null
  setHoveredCardId: (id: string | null) => void
}
```

---

## Task Acceptance Criteria

### Phase 1: Data Foundation

| Task | Done When |
|------|-----------|
| 1.1 | Drizzle schema compiles, `drizzle-kit push` succeeds, all tables visible in Supabase dashboard |
| 1.2 | Inngest function runs successfully, `cards` table has ~30k rows, DFC cards have `card_faces` populated, no duplicate `oracle_id`s |
| 1.3 | `SELECT * FROM cards WHERE search_vector @@ to_tsquery('simple', 'lightning:*')` returns Lightning Bolt and similar. GIN index exists. |
| 1.4 | `GET /api/cards/search?q=sol` returns Sol Ring within 200ms. Max 20 results. Card includes `image_uris`. |
| 1.5 | Inngest price update function runs, `cards.prices` column has non-null values for >90% of cards |
| 1.6 | `edhrec_commanders` table has data for at least 3 test commanders (e.g., Atraxa, Edgar Markov, Ur-Dragon). Synergy data includes card names and scores. |
| 1.7 | `edhrec_salt_scores` table has >100 entries with valid `card_id` FKs |
| 1.8 | Card image component renders: normal card (Lightning Bolt), transform DFC (Delver of Secrets — both faces with flip), MDFC (Emeria's Call), split card (Fire // Ice). No broken images. |
| 1.9 | Card count ~30k ± 2k. All image types render. Search returns relevant results for 10 test queries. |
| 1.10 | Supabase dashboard shows DB size < 300MB |

### Phase 2: Authentication

| Task | Done When |
|------|-----------|
| 2.1 | `@supabase/ssr` installed. Three client helpers created. Email + Google + GitHub auth enabled in Supabase dashboard. |
| 2.2 | Can sign up with email, receive confirmation, sign in. Can sign in with Google OAuth. Redirects to `/decks` after login. |
| 2.3 | Unauthenticated visit to `/decks` redirects to `/login`. Authenticated visit to `/login` redirects to `/decks`. Token refresh works (session persists across page reloads). Route Handlers return 401 for unauthenticated requests. |
| 2.4 | Profile page shows display name and avatar. Can update both. Default bracket saves and persists. |
| 2.5 | Super admin can: add AI provider with encrypted API key, set models per task type, set daily spend cap. Non-admin cannot access `/admin`. `INITIAL_ADMIN_EMAIL` user auto-promoted on first login. |
| 2.6 | RLS policies applied. Verified: user A cannot read user B's private decks. Public decks readable by all. Cards table readable by anon. |
| 2.7 | Settings page saves theme preference (light/dark toggles correctly) and default bracket. |

### Phase 3: Deck Management

| Task | Done When |
|------|-----------|
| 3.1 | Deck list page shows all user's decks. Each deck shows commander image, name, bracket badge, card count, last updated date. Empty state shown for new users. |
| 3.2 | Can create a deck: name, search and select commander, optionally select partner, set bracket. Commander search filters to commander-legal cards only. |
| 3.3 | Deck detail page renders three areas: main deck view, collapsible AI panel (right), stats bar (top). |
| 3.4 | Card search typeahead works with <300ms perceived latency. Adding a card updates the deck view and stats bar. Color identity validation: cannot add cards outside commander's color identity (with error message). |
| 3.5 | Can remove a card. Deck view and stats update immediately. |
| 3.6 | Cards auto-assigned `card_type` on add. Rule-based `functional_role` heuristic assigns roles for >60% of cards. Manual override works via dropdown. |
| 3.7 | Stats bar shows: card count (X/100), average CMC to 1 decimal, color distribution as colored pips, total price in USD. All update reactively. |
| 3.8 | Can edit deck name, description, bracket, budget. Changes persist on reload. |
| 3.9 | Delete shows confirmation dialog. Confirmed delete removes deck and all associated deck_cards. Redirects to deck list. |
| 3.10 | Version snapshot created on: deck import, bulk swap acceptance. Version history shows list with timestamps and change summaries. Can restore previous version. |

### Phase 4-7: Acceptance Criteria

| Task | Done When |
|------|-----------|
| 4.1 | Card grid displays cards grouped by `card_type`. Cards shown as images in responsive columns (4 cols desktop, 2 tablet, 1 mobile). |
| 4.2 | Commander card(s) displayed at larger size above the grid. Partner shown alongside if applicable. |
| 4.3 | Recharts bar chart shows CMC distribution. Clicking a bar highlights cards at that CMC. |
| 4.4 | Color pie chart shows color distribution accurately. |
| 4.5 | Hovering a card shows full-size image in a popover. DFCs show front face with flip button. |
| 4.6 | Toggle between image grid and compact text list. List shows: name, type, CMC, price. |
| 4.7 | Light/dark mode works. System preference detected on first visit. Toggle persists across sessions. |
| 4.8 | Desktop: three-column (deck grid main, AI panel right collapsible, stats top bar). Tablet: AI panel collapses to overlay. Mobile: stacked with bottom nav tabs. |
| 5.1 | Parser handles: `1 Sol Ring`, `1x Sol Ring`, `1 Sol Ring (C21) 123`, `1 Delver of Secrets // Insectile Aberration`. Commander line detected via `*CMDR*` suffix. |
| 5.2 | Test with 10 real-world deck lists: >95% card names resolve. Unmatched cards shown with fuzzy suggestions (top 3 matches). User can pick correct match or skip. |
| 5.3 | Import UI: textarea with format examples. Preview shows matched cards with images. Unmatched cards highlighted. Confirm button creates deck with all matched cards. |
| 5.4 | Export produces valid MTGO and Arena format text. Re-importing an export produces identical deck. |
| 5.5 | Public deck URL loads read-only view for unauthenticated users. Private decks return 404. |
| 6.1 | Vercel AI SDK configured. Can call both Anthropic and OpenAI from Route Handler. Provider/model read from `admin_ai_config`. |
| 6.2 | System prompt includes: role, bracket targets table, salt awareness, functional category targets. Produces coherent analysis for a test deck. |
| 6.3 | Serializer produces <25k tokens for a full 99-card deck with EDHREC data. Progressive trimming activates for oversized contexts. |
| 6.4 | `POST /api/ai/analyze` streams structured analysis. Client renders progressive results as sections complete. Full analysis completes in <30s. |
| 6.5 | Analysis covers all 7 functional categories with ratings, mana base assessment, synergy score, dead cards, strengths, weaknesses. |
| 6.6 | Analysis results display as structured cards/sections. Each category shows count vs target, rating badge, card list, notes. |
| 6.7 | Analysis saved to `deck_analyses`. Token count and cost tracked. History viewable per deck. |
| 7.1 | Recommendations stream progressively. Each recommendation has tier, card_out/in, reasoning, tags. |
| 7.2 | UI shows tiered sections with card images, reasoning, price delta, salt delta, impact tags. |
| 7.3 | "Find replacement" returns 3-5 alternatives within 5 seconds. Each has reasoning and comparison to original. |
| 7.4 | Accept applies swap to deck, reject dismisses. Accepting creates version snapshot. Deck stats update after swaps. |
| 7.5 | With budget set, AI does not recommend cards pushing total over budget. Price delta shown per recommendation. |
| 7.6 | With bracket set, AI avoids recommending cards above target bracket. Estimated bracket-after shown in summary. |
| 7.7 | Recommendation history shows past rounds with accept/reject status. Can compare deck state before/after each round. |

### Per-Phase Testing Strategy

| Phase | Test Type | Coverage |
|-------|-----------|----------|
| Phase 1 | Unit tests (Vitest) | Scryfall sync parser, card search query builder, EDHREC client, card image URL resolver (DFC handling) |
| Phase 2 | Integration tests (Vitest) | Auth flow (sign up, sign in, middleware redirect), RLS policies (via Supabase client with different roles) |
| Phase 3 | Unit + Integration (Vitest) | Deck CRUD server actions, category assignment, text parser, version snapshot |
| Phase 4 | Component tests (Vitest + Testing Library) | Card grid rendering, chart data, responsive breakpoints |
| Phase 5 | Unit tests (Vitest) | Text list parser (10 real-world deck lists), card name fuzzy matching, export formatting |
| Phase 6 | Integration tests (Vitest) | Context serializer token counting, streaming endpoint (mocked AI provider), error handling paths |
| Phase 7 | Integration + E2E (Vitest + Playwright) | Swap acceptance flow end-to-end, budget/bracket constraint verification |

**Test data:** Create `src/test/fixtures/` with:
- `test-deck-atraxa.txt` — real Atraxa superfriends deck (99 cards)
- `test-deck-edgar.txt` — real Edgar Markov vampires deck
- `test-deck-malformed.txt` — deck list with typos, missing quantities, DFC names
- `scryfall-sample.json` — 100 cards from Scryfall bulk data (mix of normal, DFC, split, adventure)

---

## Implementation Phases

### Phase 0: Project Scaffolding & Infrastructure
**Goal:** Get the project running with all tooling configured.

| # | Task | Details |
|---|------|---------|
| 0.1 | Initialize Next.js 15 project | App Router, TypeScript strict, Tailwind v4, ESLint |
| 0.2 | Set up shadcn/ui + providers | Install shadcn CLI, configure theme (clean/modern/minimal), add base components. Create `src/components/providers.tsx` with TanStack Query `QueryClientProvider`. Wrap in root layout. |
| 0.3 | Set up Supabase | Create project, configure environment variables, install client |
| 0.4 | Set up Drizzle ORM | Configure with Supabase connection pooler URI, create initial schema |
| 0.5 | Set up Vitest + Playwright | Configure test runners, add scripts to package.json |
| 0.6 | Set up Vercel deployment | Connect repo, configure env vars, verify preview deploys work |
| 0.7 | Configure project structure | Establish folder conventions (see below) |
| 0.8 | Set up CI | GitHub Actions: lint, type-check, test on PR |
| 0.9 | Set up Sentry | Error tracking and performance monitoring |
| 0.10 | Set up Inngest | Install `inngest` package, create `/api/inngest` Route Handler, configure Inngest client with event key. Verify with a test function. |
| 0.11 | Initialize git repo + GitHub | Create repo, add .gitignore, initial commit, branch protection |

**Folder Structure:**
```
src/
├── app/
│   ├── (auth)/             # Auth pages (login, register)
│   ├── (dashboard)/        # Authenticated pages
│   │   ├── decks/          # Deck list, deck detail, new deck
│   │   ├── playgroups/     # Playgroup management (post-MVP)
│   │   ├── matches/        # Match history (post-MVP)
│   │   └── settings/       # User settings
│   ├── (admin)/            # Super admin pages
│   │   └── admin/          # AI config, usage dashboard
│   ├── api/
│   │   ├── ai/             # AI streaming endpoints
│   │   ├── import/         # Deck import endpoints
│   │   ├── cards/          # Card search endpoints
│   │   └── inngest/        # Background job webhook
│   ├── layout.tsx
│   └── page.tsx            # Landing page
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── deck/               # Deck-specific components
│   ├── cards/              # Card display components (incl. DFC handling)
│   ├── ai/                 # AI panel components
│   └── layout/             # Shell, nav, sidebar
├── lib/
│   ├── db/
│   │   ├── schema.ts       # Drizzle schema definitions
│   │   ├── migrations/     # Generated SQL migrations
│   │   └── queries/        # Reusable query functions
│   ├── ai/
│   │   ├── providers.ts    # Vercel AI SDK provider config
│   │   ├── schemas.ts      # Zod schemas for AI output
│   │   ├── prompts.ts      # System prompts and templates
│   │   └── context.ts      # Deck context serializer
│   ├── scryfall/
│   │   ├── client.ts       # API client
│   │   ├── sync.ts         # Bulk data sync job
│   │   └── types.ts        # Scryfall response types
│   ├── edhrec/
│   │   ├── client.ts       # JSON endpoint client
│   │   ├── cache.ts        # Cache management
│   │   └── types.ts        # EDHREC response types
│   ├── import/             # Deck import parsers
│   ├── export/             # Deck export formatters
│   └── utils/
├── hooks/
├── stores/
├── types/
└── config/
```

---

### Phase 1: Data Foundation
**Goal:** Card database populated and searchable.

| # | Task | Details |
|---|------|---------|
| 1.1 | Create Drizzle schema | All tables from schema section. Run `drizzle-kit generate` + `push` |
| 1.2 | Build Scryfall bulk sync job | Inngest function: (1) Call `GET https://api.scryfall.com/bulk-data` to get Oracle Cards download URL, (2) download JSON (~162MB) via streaming fetch, (3) parse with `stream-json` library (StreamArray for top-level array), (4) batch upsert in groups of 500 via `INSERT ON CONFLICT (oracle_id)`, (5) store `card_faces` for DFCs. Set `User-Agent: DeckPilot/1.0` header on all Scryfall requests. Inngest free tier: 1hr max execution, sufficient for this. |
| 1.3 | Build FTS search infrastructure | Generated `tsvector` column on cards (name + type_line + oracle_text), GIN index, prefix search RPC |
| 1.4 | Build card search API | Route handler: debounced prefix search, returns card + image data, max 20 results |
| 1.5 | Build Scryfall price update job | Daily Inngest job: fetch price data, update `prices` column. Uses Scryfall bulk price data. |
| 1.6 | Build EDHREC client | Fetch `json.edhrec.com/pages/commanders/{slug}.json`, parse synergy data, upsert to `edhrec_commanders` with 24h TTL. Retry with backoff. Graceful fallback if 403/404. |
| 1.7 | Build EDHREC salt score sync | Fetch `json.edhrec.com/pages/salt.json`, match to `card_id` via card name lookup, store in `edhrec_salt_scores`. Fallback: if endpoint returns 403, try alternative fetch pattern or mark as unavailable. |
| 1.8 | Build card image component | Next.js Image wrapping Scryfall CDN URLs. Handles normal cards (top-level `image_uris`) AND DFCs (`card_faces[n].image_uris`). Flip animation for DFCs. Lazy loading + blur placeholder. **Prerequisite:** Add `cards.scryfall.io` to `remotePatterns` in `next.config.js`. |
| 1.9 | Seed data verification | Verify: card count (~30k), DFC rendering, search quality (fuzzy + prefix), image loading across card types |
| 1.10 | Storage budget check | Verify Supabase DB size after sync. Target: < 300MB (leaving headroom on 500MB free tier). If over, drop `raw_data` column or move to Supabase Pro. |

**Scryfall Bulk Sync Strategy:**
- Uses Inngest (NOT Vercel cron — 60s limit is insufficient)
- Downloads Oracle Cards bulk file (one entry per unique card)
- Stream-parses JSON to avoid memory issues
- Upserts via batched INSERT ON CONFLICT (oracle_id)
- Runs daily at 3 AM UTC
- First run: ~5-10 minutes. Subsequent runs: ~2-3 minutes (mostly no-ops)
- Manual trigger available via super admin panel

---

### Phase 2: Authentication & User Management
**Goal:** Users can sign up, log in, and manage their profile.

**Supabase SSR Auth Architecture:**

This phase requires `@supabase/ssr` (NOT just `@supabase/supabase-js`). Supabase Auth in Next.js App Router uses cookies (not localStorage) for session management. Three client variants are needed:

| Context | Client Factory | Cookie Access |
|---------|---------------|---------------|
| Server Components / Server Actions | `createServerClient()` with `cookies()` from `next/headers` | Read-only (can read session, cannot set cookies) |
| Route Handlers | `createServerClient()` with `cookies()` from `next/headers` | Read/write (can refresh tokens) |
| Middleware | `createServerClient()` with `request.cookies` + `response.cookies` | Read/write (refreshes expired tokens, sets new cookies on response) |
| Client Components | `createBrowserClient()` | Automatic (browser cookies) |

**Auth flow in middleware (`src/middleware.ts`):**
1. Create Supabase client with request/response cookie access
2. Call `supabase.auth.getUser()` (this refreshes expired tokens automatically)
3. If no user and route is protected (`/decks/*`, `/settings/*`, `/admin/*`), redirect to `/login`
4. If user and route is auth page (`/login`, `/register`), redirect to `/decks`
5. **Super admin bootstrap:** NOT handled in middleware (Edge Runtime limitations). Instead, handled in the auth callback Route Handler (`/auth/callback`): after confirming the user session, check if user email matches `INITIAL_ADMIN_EMAIL` and `is_super_admin` is false. If so, update the profile via Supabase service role client. Runs once per admin setup.

**Helper files to create:**
- `src/lib/supabase/server.ts` — exports `createClient()` for Server Components/Actions/Route Handlers
- `src/lib/supabase/client.ts` — exports `createClient()` for Client Components
- `src/lib/supabase/middleware.ts` — exports `updateSession()` helper for middleware

| # | Task | Details |
|---|------|---------|
| 2.1 | Configure Supabase Auth | Install `@supabase/ssr`. Enable email/password + Google OAuth + GitHub OAuth providers in Supabase dashboard. Create the three client factory helpers (server, client, middleware). |
| 2.2 | Build auth pages | Sign up, sign in, forgot password, email confirmation. Clean/minimal design. Use `createBrowserClient()` for auth forms. OAuth callback handler at `/auth/callback` Route Handler. |
| 2.3 | Build auth middleware | `src/middleware.ts`: refresh session via `updateSession()`, protect dashboard/admin routes, redirect logic. Matcher config excludes static assets and API routes. Route Handlers verify auth via `createServerClient()` + `getUser()` at the start of each handler. |
| 2.4 | Build profile page | Display name, avatar upload (Supabase Storage), default bracket preference. Server Component fetches profile via `createServerClient()`. |
| 2.5 | Build super admin panel | AI provider config: add/edit providers, set models per task type, manage API keys (encrypted via app-level AES-256-GCM — see encryption details below), set daily usage limits. Protected by `is_super_admin` check in Server Component. |
| 2.6 | Set up RLS policies | Row-level security for all tables — see RLS Policy SQL section below |
| 2.7 | Build settings page | User preferences: default bracket, theme (light/dark), notification preferences |

---

### Phase 3: Deck Management (CRUD)
**Goal:** Users can create, view, edit, and delete decks.

| # | Task | Details |
|---|------|---------|
| 3.1 | Build deck list page | Grid/list of user's decks with commander image, name, bracket, card count, last updated |
| 3.2 | Build new deck flow | Name, commander picker (card search with commander filter), partner picker if applicable, format, bracket target, budget (optional) |
| 3.3 | Build deck detail page (shell) | Layout: stats bar (top, always visible) + deck view (main content area) + AI panel (right sidebar, collapsible). Two-column with top bar, not three-column. |
| 3.4 | Build card search + add to deck | Typeahead search, shows card image preview on hover, click to add. Respects color identity. |
| 3.5 | Build card removal | Remove cards from deck with confirmation |
| 3.6 | Build category management | Auto-assign `card_type` from card data on add. `functional_role` has two modes: (1) Pre-AI: rule-based heuristic assignment using keywords/type_line (e.g., cards with "destroy target" → removal, "draw" in oracle text → card_draw, "add {" in oracle text → ramp). (2) Post-Phase 6: AI-assigned roles on first analysis override heuristics. Manual override always available. |
| 3.7 | Build deck stats bar | Card count (with /100 indicator), average CMC, color distribution pips, total price |
| 3.8 | Build deck settings | Edit name, description, bracket, budget, playgroup assignment |
| 3.9 | Build deck deletion | With confirmation dialog |
| 3.10 | Build deck versioning | Auto-snapshot deck state on significant changes (AI swap acceptance, bulk import). Version history viewable. Restore to previous version. |

---

### Phase 4: Deck Layout (MVP — Standard Grid)
**Goal:** A clean, functional deck view. Novel layout deferred to post-MVP.

| # | Task | Details |
|---|------|---------|
| 4.1 | Build standard card grid | Cards grouped by card_type (Creatures, Instants, Sorceries, etc.), displayed as card images in a responsive grid |
| 4.2 | Build commander hero section | Commander card(s) displayed prominently at top of deck view |
| 4.3 | Build mana curve chart | Recharts bar chart showing CMC distribution |
| 4.4 | Build color distribution chart | Color pie/donut chart |
| 4.5 | Build card hover preview | Full-size card image on hover (handles DFCs with flip) |
| 4.6 | Build list view toggle | Switch between card image grid and compact text list |
| 4.7 | Build light/dark mode | System preference detection + manual toggle via shadcn theme |
| 4.8 | Build responsive layout | Desktop: two-column (deck grid main + AI panel right sidebar) with stats top bar. Tablet: AI panel collapses to overlay. Mobile: stacked views with bottom nav tabs. |

---

### Phase 5: Deck Import & Export (MVP — Text Only)
**Goal:** Users can import via text lists and export in standard formats.

| # | Task | Details |
|---|------|---------|
| 5.1 | Build text list parser | Parse MTGO format ("1 Card Name"), Arena format ("1 Card Name (SET) #"), and common variations. Handle commander designation (e.g., "1 Card Name *CMDR*"). |
| 5.2 | Build card matching/resolution | Match pasted card names to `cards` table. Fuzzy match for typos. Show disambiguation UI when multiple matches. Handle DFC names (match on either face name). |
| 5.3 | Build import UI | Paste text list in a textarea. Preview matched cards before confirming import. Show unmatched cards with resolution options. |
| 5.4 | Build text list export | MTGO format and Arena format export |
| 5.5 | Build shareable link | Public deck URL with read-only view (uses `is_public` flag) |

**Post-MVP import additions:** Archidekt URL import (5.6), Moxfield URL import (5.7), CSV export (5.8)

---

### Phase 6: AI Integration — Core
**Goal:** AI can analyze decks and provide structured analysis.

| # | Task | Details |
|---|------|---------|
| 6.1 | Configure Vercel AI SDK | Multi-provider setup. Read active provider config from `admin_ai_config` table. Route to correct provider/model per task type. |
| 6.2 | Build AI system prompt | Commander expert role. Include bracket system rules, salt awareness, functional category targets (e.g., "a typical Commander deck wants 10+ ramp sources"). Use prompt template with variable injection for constraints. |
| 6.3 | Build deck context serializer | Convert deck to token-budgeted context (see AI Architecture section). Progressive trimming if over 25k tokens. Include EDHREC synergy data, user annotations, match history summary. |
| 6.4 | Build analysis streaming endpoint | Route Handler using Vercel AI SDK `streamObject()` with `DeckAnalysisSchema`. Streams structured analysis progressively. |
| 6.5 | Build analysis results UI | Structured display: overall assessment, category-by-category breakdown (ramp, draw, removal, etc.) with ratings, mana base analysis, synergy highlights, dead cards, strengths/weaknesses list, salt assessment. |
| 6.6 | Store analysis results | Save to `deck_analyses` table. Track token usage and cost. Link to deck version. |
| 6.7 | Build analysis error handling | Handle 429, 401, 500, timeout, malformed output per AI Error Handling section. Show appropriate UI states. |

---

### Phase 7: AI Integration — Recommendations
**Goal:** AI provides actionable, tiered swap recommendations respecting budget and bracket.

| # | Task | Details |
|---|------|---------|
| 7.1 | Build swap recommendation engine | `streamObject()` with `SwapRecommendationSchema` (medium response, benefits from progressive streaming — see AI Architecture function selection table). AI generates tiered suggestions respecting target bracket AND budget constraint. Include EDHREC synergy scores and salt deltas. Client consumes via `useObject()` from `ai/react`. |
| 7.2 | Build recommendations UI | Tiered card lists (must cut / consider cutting / must add / consider adding). Each card shows: image, reasoning, synergy score, price delta, salt delta, impact tags. |
| 7.3 | Build "find replacement" action | Click any card in deck → AI suggests 3-5 specific replacements with per-card reasoning. Uses `generateObject()` with a simpler schema. Lighter model (Haiku-class). |
| 7.4 | Build accept/reject flow | User accepts or rejects each recommendation. Accepted swaps auto-apply to deck. Creates a deck version snapshot before applying. |
| 7.5 | Build budget-aware recommendations | Budget constraint injected into AI context. AI avoids suggesting cards that would push deck over budget. Price delta shown per recommendation. |
| 7.6 | Build bracket-aware recommendations | Target bracket injected into AI context. AI avoids cards associated with higher brackets. Estimated bracket-after shown in recommendation summary. |
| 7.7 | Build recommendation history | View past recommendation rounds per deck. See what was accepted/rejected. Compare deck versions before/after recommendations. |

---

### Phase 8: AI Integration — Chat Sidebar (Post-MVP)
**Goal:** Freeform AI discussion alongside the structured flow.

| # | Task | Details |
|---|------|---------|
| 8.1 | Build chat UI | Collapsible sidebar with message history, streaming responses |
| 8.2 | Build chat context | Chat has full deck context (same as analysis) + current recommendations state |
| 8.3 | Build card mentions | AI can mention cards in chat → rendered as interactive card links with hover preview |
| 8.4 | Build action suggestions | AI can suggest deck modifications from chat → user confirms to apply |
| 8.5 | Build conversation persistence | Save chat history per deck in Supabase |

---

### Phase 9: New Deck Builder Flow (Post-MVP)
**Goal:** Users can start a new deck from either a theme/strategy or a commander.

| # | Task | Details |
|---|------|---------|
| 9.1 | Build entry point selector | "Start from a theme" or "Start from a commander" |
| 9.2 | Build theme browser | Popular Commander themes from EDHREC (aristocrats, voltron, blink, etc.) |
| 9.3 | Build commander suggestion | Given a theme → AI suggests commanders with EDHREC popularity data |
| 9.4 | Build commander browser | Search/filter commanders by color identity, theme, popularity |
| 9.5 | Build strategy suggestion | Given a commander → AI proposes strategy approaches with EDHREC synergy data |
| 9.6 | Build auto-generate 99 | AI generates initial 99 cards. Respects bracket/budget. Uses EDHREC high-synergy cards as candidates. |
| 9.7 | Build review & refine | User reviews generated deck, enters standard recommendation flow |

---

### Phase 10: Playgroup Features (Post-MVP)
**Goal:** Users can create and manage playgroups with shared context.

| # | Task | Details |
|---|------|---------|
| 10.1 | Build playgroup CRUD | Create, edit, delete playgroups |
| 10.2 | Build member management | Invite (by email/link), remove members, roles |
| 10.3 | Build playgroup settings | Target bracket, max salt score, house rules, banned cards list |
| 10.4 | Build playgroup deck calibration | AI factors in group's rules/bracket/banned cards when analyzing |
| 10.5 | Build playgroup deck overview | View all members' decks, comparative power analysis |

---

### Phase 11: Match History & Annotations (Post-MVP)
**Goal:** Users can log games and annotate cards for richer AI context.

| # | Task | Details |
|---|------|---------|
| 11.1 | Build match logging UI | Quick-entry: result, player count, turn count, notes, opponent commanders |
| 11.2 | Build card performance tagging | After a match, tag cards as MVP or underperformer via `match_card_performance` table |
| 11.3 | Build card annotation UI | On any card in deck view, add a note. Persisted in `deck_cards.user_note`. |
| 11.4 | Build match history view | Per-deck match log with win rate, trends chart |
| 11.5 | Build AI match context | Feed match history + annotations into AI analysis for personalized recommendations |

---

### Phase 12: Novel Deck Layout (Post-MVP)
**Goal:** Upgrade from standard grid to a distinctive, Archidekt-inspired-but-novel layout.

| # | Task | Details |
|---|------|---------|
| 12.1 | Design novel layout concept | Explore: spatial/zoomable canvas, card clusters by functional role, mana curve as visual element, commander as hero anchor. Create wireframes/mockups before building. |
| 12.2 | Build card cluster view | Cards grouped by functional role with visual distinction |
| 12.3 | Build drag-and-drop (dnd-kit) | Drag cards between categories, reorder within categories |
| 12.4 | Build interactive stats | Click on mana curve bar to filter/highlight cards at that CMC |
| 12.5 | Build card type breakdown visualization | Visual breakdown of creatures/instants/sorceries/etc. |

---

### Phase 13: Polish & Launch Prep
**Goal:** Production-ready quality.

| # | Task | Details |
|---|------|---------|
| 13.1 | Performance optimization | Image lazy loading, virtual lists for large card sets, query caching tuning |
| 13.2 | Error handling & loading states | Skeleton loaders, error boundaries, toast notifications |
| 13.3 | SEO & meta tags | Open Graph for shared deck links, landing page SEO |
| 13.4 | Landing page | Marketing page explaining DeckPilot, sign-up CTA |
| 13.5 | Onboarding flow | First-time user guide: import first deck → run first analysis → review recommendations |
| 13.6 | Rate limiting & abuse prevention | API rate limits, AI usage caps, Sentry alerting |
| 13.7 | E2E test suite | Playwright tests for critical flows (import → analyze → accept swaps → export) |
| 13.8 | Accessibility audit | Keyboard navigation, screen reader testing, color contrast |

---

## Phase Dependencies

```
Phase 0 (Scaffolding)
  └→ Phase 1 (Data Foundation)
       └→ Phase 2 (Auth + Admin)
            └→ Phase 3 (Deck CRUD + Versioning)
                 ├→ Phase 4 (Standard Deck Layout) ─┐
                 ├→ Phase 5 (Text Import/Export)     ├→ Phase 6 (AI Core)
                 └─────────────────────────────────────┘      │
                                                              └→ Phase 7 (AI Recs)

Post-MVP (can be parallelized):
  Phase 7 → Phase 8 (Chat Sidebar)
  Phase 7 → Phase 9 (New Deck Builder)
  Phase 3 → Phase 10 (Playgroups)
  Phase 3 → Phase 11 (Match History)
  Phase 4 → Phase 12 (Novel Layout)
  All → Phase 13 (Polish)
```

**Critical path:** 0 → 1 → 2 → 3 → 5 (import enables AI testing) → 6 → 7

**Parallelizable in MVP:** After Phase 3, Phases 4 and 5 can run in parallel. Phase 6 depends on 5 (need real decks to test AI).

---

## MVP Scope (Phases 0–7)

The minimum viable product includes:
- **Phase 0:** Project scaffolding, CI, monitoring, background jobs
- **Phase 1:** Card database (Scryfall sync, EDHREC cache, search, card images with DFC support)
- **Phase 2:** Auth (email/password + OAuth) + super admin panel for AI config
- **Phase 3:** Deck CRUD with versioning
- **Phase 4:** Standard card grid layout (clean/minimal, responsive, light/dark mode)
- **Phase 5:** Text list import/export (Archidekt/Moxfield URL import is post-MVP)
- **Phase 6:** AI analysis engine (structured output, streaming, error handling)
- **Phase 7:** AI recommendations (tiered swaps, find replacement, budget-aware, bracket-aware)

**Estimated task count:** ~52 tasks

**Post-MVP:** Chat sidebar (8), new deck builder (9), playgroups (10), match history (11), novel layout (12), polish (13).

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| EDHREC endpoints change/break | 24h cache with stale-while-revalidate. App functions without EDHREC (Scryfall only). Monitor for 404/403. |
| Scryfall bulk sync exceeds Vercel cron limit | Use Inngest for background jobs (no 60s limit). Manual trigger via admin panel. |
| Supabase free tier storage exceeded | Use Oracle Cards only (~30k rows). Drop any `raw_data` if needed. Monitor via admin panel. Budget: < 300MB target. |
| AI token costs accumulate | Track cost per analysis in `deck_analyses.cost_cents`. Daily spend cap in `admin_ai_config`. Admin dashboard shows usage trends. |
| AI output quality inconsistent | Use `generateObject()` with Zod schemas for structured output. Enforce via schema validation. Build eval set of golden test decks. |
| Context window overflow | Progressive trimming strategy (match history → EDHREC → card details). Hard cap at 25k input tokens. |
| Card name ambiguity on import | Fuzzy matching with disambiguation UI. DFC names match on either face. |
| DFC rendering bugs | Test with representative DFCs: transform (Delver), MDFC (Emeria's Call), split (Fire // Ice), adventure (Bonecrusher). |
| API key security | Platform-managed keys (not user-stored for MVP). Encrypted via app-level AES-256-GCM with `ENCRYPTION_KEY` env var. Keys never exposed to client. |
| Archidekt/Moxfield block API access | Text list import as universal fallback (MVP). URL import is post-MVP nice-to-have. |

---

## Success Metrics

- **Time to analyze:** Import a deck and get AI analysis in < 30 seconds
- **Recommendation quality:** User accepts > 60% of AI swap suggestions
- **Completeness:** Analysis covers all functional categories (ramp, draw, removal, board wipes, win cons, protection)
- **Power calibration:** Recommendations stay within target bracket ± 0.5
- **Cost efficiency:** Average analysis cost < $0.15 per full analysis
- **Import success rate:** > 95% of pasted card names resolve on first match
- **DFC rendering:** Zero broken images for DFC/split/adventure cards
