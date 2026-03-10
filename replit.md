# MedShare - replit.md

## Overview

MedShare is a charitable web application that allows community members to donate and request surplus household medicines safely and for free. The platform is non-commercial and community-based, focused on reducing medicine waste and helping people access medications they need at no cost.

Key features:
- Medicine donation and request system with quantity tracking (boxes, strips, pills)
- Location-based filtering so users see donations within their registered country
- Bilateral delivery confirmation between donor and requester
- In-app messaging between parties on a request
- Admin panel for managing medicine categories and reviewing flagged content
- Anti-fraud protections: active donation limits per user, expiry date enforcement, mandatory charitable-use declaration
- Full Arabic/English bilingual support with RTL/LTR switching

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React (with TypeScript, Vite as bundler)
- **Routing**: Wouter (lightweight client-side routing)
- **State/Data Fetching**: TanStack React Query v5 — all server state is managed through query keys matching API endpoint paths (e.g. `["/api/donations/mine"]`)
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives, styled with Tailwind CSS
- **Internationalization**: i18next with react-i18next and browser language detection; supports English and Arabic with RTL layout switching via `document.documentElement.dir`
- **Forms**: React Hook Form with Zod resolvers

**Page structure** (`client/src/pages/`):
- `landing.tsx` — Public marketing page with login CTA
- `profile-setup.tsx` — First-time setup: country, governorate, area selection + charitable declaration
- `home.tsx` — Dashboard with stats (active donations, pending requests)
- `donate.tsx` — Donation form with multi-quantity input
- `browse.tsx` — Search/filter available donations; request flow
- `my-donations.tsx` — Donor view of their donations + incoming requests management
- `my-requests.tsx` — Requester view of their requests
- `request-detail.tsx` — Messaging thread + delivery confirmation
- `admin.tsx` — Category management + flagged content review
- `profile.tsx` — Edit user profile (name, photo URL, location settings)

### Backend Architecture
- **Runtime**: Node.js with Express (TypeScript, ESM modules)
- **Entry point**: `server/index.ts` → registers routes → sets up Vite dev middleware or serves static build
- **Route registration**: `server/routes.ts` handles all `/api/*` routes
- **Storage layer**: `server/storage.ts` defines `IStorage` interface; the concrete class wraps Drizzle ORM queries — keeping business logic separate from HTTP handlers
- **Build**: Custom build script (`script/build.ts`) bundles server with esbuild and client with Vite

**Key business rules enforced on the backend:**
- Max 10 active donations per user (`MAX_ACTIVE_DONATIONS`)
- Expired medicines are rejected at donation creation and hidden from browse results
- Donations are filtered by the requesting user's registered country
- Medicine name validation: OpenFDA drug database autocomplete on English name field; unrecognized names show a warning and are auto-flagged for admin review
- Duplicate request prevention: users cannot submit a second non-rejected request for the same donation
- Donation edit/delete: owners can edit active donations (name, notes, location) and delete them if no pending/approved requests exist
- Dashboard `totalDonated` counts only completed donations
- Public stats API (`GET /api/stats/public`) returns total available and completed donations
- Profile editing via `PATCH /api/auth/user` for name/photo changes
- Only admins can manage categories or review flags

### Data Storage

**Database**: PostgreSQL via Drizzle ORM (`drizzle-orm/node-postgres`)

**Schema** (`shared/schema.ts`) — key tables:
| Table | Purpose |
|---|---|
| `users` | Auth users (managed by Replit Auth) |
| `sessions` | Session persistence (connect-pg-simple) |
| `user_profiles` | Extended user data: country, governorate, area, declaration, isAdmin, activeDonationsCount |
| `countries` / `governorates` / `areas` | 3-level location hierarchy seeded for Arabic-speaking countries |
| `medicine_categories` | Admin-managed categories with Arabic/English names |
| `donations` | Medicine donations with quantities (JSONB), expiry date, location, status |
| `requests` | Requests against a donation with requested quantities, status, delivery scheduling |
| `messages` | Chat messages per request thread |
| `delivery_confirmations` | Dual-confirmation records (donor + requester both confirm delivery) |
| `notifications` | User notifications (new requests, messages, status changes) with bilingual titles |
| `admin_flags` | Flagged content for admin review |

**Migrations**: Drizzle Kit (`drizzle-kit push` / `migrations/` directory)

**Seeding**: `server/seed-locations.ts` provides static seed data for all 22 Arab League countries with their governorates and areas, called on server startup via `storage.seedInitialData()`.

### Authentication & Authorization

- **Provider**: Replit Auth (OpenID Connect / OIDC)
- **Implementation**: `server/replit_integrations/auth/` — uses `openid-client` + `passport` + `passport-local` strategy
- **Session storage**: PostgreSQL-backed sessions via `connect-pg-simple`, stored in the `sessions` table
- **Session TTL**: 7 days with secure, httpOnly cookies
- **OIDC config**: memoized for 1 hour to avoid repeated discovery calls
- **Route protection**: `isAuthenticated` middleware checks for valid session + refreshes tokens if near expiry
- **Admin check**: `userProfiles.isAdmin` boolean field checked server-side for admin routes
- **Client-side auth**: `useAuth()` hook queries `/api/auth/user`, caches for 5 minutes

### Key Design Patterns
- **Shared schema**: `shared/` directory is imported by both client and server via TypeScript path aliases (`@shared/*`), ensuring types are consistent across the stack
- **Path-based query keys**: React Query query keys match API URL paths, making cache invalidation predictable
- **RTL support**: Language switcher toggles `document.documentElement.dir` and `i18n.language`; sidebar renders on the correct side based on language

## External Dependencies

### Replit-Specific Integrations
- **Replit Auth**: OIDC authentication via `https://replit.com/oidc` — requires `REPL_ID` and `ISSUER_URL` environment variables
- **Replit Vite plugins**: `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner` (dev only)

### Required Environment Variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing secret |
| `REPL_ID` | Replit application ID (for OIDC) |
| `ISSUER_URL` | OIDC issuer (defaults to `https://replit.com/oidc`) |

### Key NPM Dependencies
- `drizzle-orm` + `drizzle-zod` — ORM and schema validation
- `pg` — PostgreSQL driver
- `connect-pg-simple` — PostgreSQL session store
- `passport` + `openid-client` — Authentication
- `express-session` — Session management
- `i18next` + `react-i18next` + `i18next-browser-languagedetector` — Internationalization
- `@tanstack/react-query` — Server state management
- `wouter` — Client-side routing
- `tesseract.js` — Browser-based OCR for scanning medicine names from photos
- `date-fns` — Date manipulation (expiry checks)
- `memoizee` — OIDC config caching
- `lucide-react` — Icon library

### Fonts
Google Fonts: Architects Daughter, DM Sans, Fira Code, Geist Mono (loaded via CDN in `index.html`)