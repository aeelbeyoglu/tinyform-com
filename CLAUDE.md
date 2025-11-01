# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TinyForm (formerly Formcn) is a comprehensive form builder platform with both frontend and backend components. The project consists of:
1. **FormCN Frontend**: A React-based form builder UI with AI-powered form generation
2. **TinyForm API**: A Cloudflare Workers-based backend with PostgreSQL for form persistence, user management, and analytics

## Monorepo Structure

This is a Turborepo monorepo using Bun as the package manager (v1.2.20+):

- **apps/web**: Next.js 15 application (main form builder UI)
- **apps/server**: Next.js 15 API server (handles CORS, separate deployment)
- **apps/tinyform-api**: Cloudflare Workers API backend (NEW - main backend infrastructure)
- **packages/**: Currently empty but structured for shared packages

## Common Commands

### Development
```bash
# Run all workspaces in dev mode
bun dev

# Run specific workspace
bun dev:web         # Web app on port 3000
bun dev:native      # Native app
bun dev:server      # Server app

# TinyForm API
cd apps/tinyform-api
bun run dev         # Start Cloudflare Workers dev server on port 8787
```

### Building
```bash
# Build all workspaces
bun build

# Build specific workspace
bun build:web

# Build shadcn registry
cd apps/web && bun run build:registry
```

### Database (TinyForm API)
```bash
cd apps/tinyform-api
bun run db:generate    # Generate migrations
bun run db:push        # Push schema to database
bun run db:studio      # Open Drizzle Studio
```

### Type Checking
```bash
# Type check all workspaces
bun check-types
```

### Cleanup
```bash
# Clean root node_modules
bun clean

# Clean all workspace node_modules and build artifacts
bun clean:workspaces
```

## Architecture

### Form Builder Core (`apps/web/src/form-builder/`)

**State Management (Zustand):**
- `hooks/use-form-builder-store.ts`: Central store managing form state with persistence
  - Handles both single-step (`isMS: false`) and multi-step (`isMS: true`) forms
  - Key operations: `appendElement`, `dropElement`, `editElement`, `reorder`, `setTemplate`
  - Supports nested form elements (array of elements rendered side-by-side)
  - Multi-step forms use `FormStep[]` with `stepFields`, single-step uses `FormElementList`
- `components/api-aware-form-builder.tsx`: Smart form builder wrapper with API integration
  - Auto-save every 2 seconds for API-backed forms
  - UUID detection to differentiate API forms from localStorage forms

**Type System (`form-types.ts`):**
- Comprehensive union types for all form elements (Input, Textarea, Select, DatePicker, Rating, etc.)
- Distinction between form field elements and static elements (H1, H2, P, Separator)
- Each element has `SharedFormProps` (name, label, description, required, static, disabled, id)
- Supports nested elements via `FormElementOrList` type

**Code Generation:**
- `lib/generate-form-code.ts`: Generates complete React components from form schema
  - Single-step: Generates standard form with submit button
  - Multi-step: Generates form with `MultiStepFormProvider`, navigation buttons, step validation
- `lib/generate-zod-schema.ts`: Generates Zod schemas for runtime validation and code output
- `lib/generate-server-action-code.ts`: Generates Next.js server actions
- `lib/generate-imports.ts`: Analyzes form elements and generates required imports

**Key Patterns:**
- Forms are represented as either `FormElementList` (single-step) or `FormStep[]` (multi-step)
- Elements can be nested (rendered in flex rows) - represented as arrays within the main array
- Static elements (`static: true`) are excluded from Zod schema generation
- All form elements have unique IDs (UUID v4)

### Web App Structure (`apps/web/`)

**App Router Pages:**
- `/` - Landing page
- `/form-builder` - Main form builder interface with API integration
- `/forms` - API-backed forms list with publishing and embed options
- `/forms/[formId]/submissions` - Form submissions viewer with filtering and search
- `/f/[publicId]` - Public form submission page for published forms
- `/embed/[publicId]` - Embeddable form view with minimal styling
- `/my-forms` - LocalStorage-backed forms list (legacy)
- `/ai-form-generator` - AI-powered form generation
- `/api/generate` - AI generation endpoint (OpenAI GPT-4o-mini with streaming)

**Key Features:**
- **AI Form Generation**: Uses Vercel AI SDK with OpenAI, streams form schema generation
- **Rate Limiting**: Upstash Redis rate limiting (5 requests per 60s in production)
- **Analytics**: PostHog integration (with proxy rewrites for `/ingest/*`)
- **Persistence**: Dual system - API-backed forms (PostgreSQL) and localStorage forms (legacy)
- **Component Library**: Full shadcn/ui component set in `components/ui/`
- **Public Forms**: Published forms accessible via `/f/[publicId]` without authentication
- **Form Embedding**: Multiple embed options (iframe, JavaScript with auto-resize, direct link)
- **Submissions Management**: Full viewer with search, filters, pagination, and detailed view
- **Auto-save**: Forms auto-save every 2 seconds when edited (API-backed forms only)
- **Cross-domain Messaging**: PostMessage API for iframe communication and events

**Registry System (`registry/default/`):**
- Template system for generated code artifacts
- `lib/form-schema.ts`: Empty schema template (replaced during generation)
- `actions/server-action.ts`: Template server action using next-safe-action
- `actions/safe-action.ts`: Action client configuration

### Server App (`apps/server/`)

Minimal Next.js server handling CORS for cross-origin form submissions:
- Middleware adds CORS headers based on `CORS_ORIGIN` env var
- Intended as a separate deployment for production form submissions

## Form Element System

### Field Types with Options
Select, MultiSelect, Combobox, ToggleGroup require `options: Option[]` where `Option = { value: string; label: React.ReactNode }`

### Special Elements
- **DatePicker**: Supports `mode: "single" | "multiple" | "range"`
- **FileUpload**: Has `maxSize`, `maxFiles`, and `accept` (MIME types)
- **Rating**: Customizable `numberOfStars`
- **OTP**: Uses input-otp library with configurable length
- **SocialMediaButtons**: Uses predefined logos from `constant/social-logos-urls.ts`

### Nested Elements
Elements can be grouped in arrays to render side-by-side in flex containers. The store handles nested operations via optional `j` parameter (nested index).

## Tech Stack

**Web App:**
- Next.js 15 (App Router, Turbopack, typed routes)
- React 19
- Tailwind CSS v4
- shadcn/ui (Radix UI primitives)
- Zod 4.x for validation
- React Hook Form with Zod resolver
- Zustand for state management
- Vercel AI SDK (@ai-sdk/openai, @ai-sdk/react)
- next-safe-action for type-safe server actions
- PostHog for analytics
- Framer Motion (via "motion" package)

**Development:**
- Bun 1.3.0+ as package manager
- Turborepo for monorepo orchestration
- TypeScript 5 (strict mode enabled)

## Development Guidelines

### Working with Forms
1. Form elements are immutable - always clone before modifying
2. Use store actions (`appendElement`, `editElement`, etc.) instead of direct state mutation
3. Multi-step forms require `stepIndex` parameter for all operations
4. Nested elements require `j` parameter (nested array index)

### Code Generation
- Generated code uses registry templates as base
- Always flatten form elements before generating imports/schemas
- Multi-step forms use `MultiStepFormProvider` pattern with step validation
- Server actions use next-safe-action for type safety

### Adding New Form Elements
1. Add type definition to `form-types.ts`
2. Add default values to `constant/default-form-element.ts`
3. Add to form elements list in `constant/form-elements-list.ts`
4. Implement rendering in `lib/generate-form-component.ts`
5. Add Zod schema logic in `lib/generate-zod-schema.ts`
6. Update imports generator if new dependencies needed

### Environment Variables
- `OPENAI_API_KEY`: Required for AI form generation
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: Rate limiting
- `CORS_ORIGIN`: Server app CORS configuration
- `NODE_ENV`: Controls rate limiting (disabled in development)

## TinyForm API Backend (`apps/tinyform-api/`)

### Technology Stack
- **Runtime**: Cloudflare Workers (Edge computing)
- **Database**: PostgreSQL (Neon) - `neondb` database
- **ORM**: Drizzle ORM with type-safe queries
- **API Framework**: Hono (lightweight, edge-optimized)
- **Authentication**: NextAuth.js with JWT tokens
- **File Storage**: Cloudflare R2
- **Cache**: Cloudflare KV
- **Queue**: Cloudflare Queues for async processing
- **Email**: Resend integration

### Database Schema (10 tables)
1. **users** - User accounts with plans (free/pro/enterprise)
2. **accounts** - OAuth provider accounts (NextAuth)
3. **sessions** - User sessions (NextAuth)
4. **verification_tokens** - Email verification (NextAuth)
5. **forms** - Form definitions with settings and metadata
6. **form_submissions** - Submitted form data with validation
7. **form_templates** - Reusable form templates
8. **api_keys** - API access keys for programmatic access
9. **webhooks** - Form submission webhooks
10. **form_analytics** - Detailed analytics per form

### API Endpoints
- **Authentication** (`/api/v1/auth/*`)
  - Sign up, sign in, session management, token refresh
- **Forms** (`/api/v1/forms/*`)
  - CRUD operations, publishing, duplication, archiving
- **Public Forms** (`/api/v1/public/*`)
  - Public form access and submission (no auth required)
- **Submissions** (`/api/v1/submissions/*`)
  - Submission management and export
- **Users** (`/api/v1/users/*`)
  - Profile management, API key generation
- **Analytics** (`/api/v1/analytics/*`)
  - Form and user analytics

### Middleware
- **Rate Limiting**: IP-based and user-based limits (using KV)
- **Authentication**: JWT verification and API key validation
- **Error Handling**: Comprehensive error middleware
- **CORS**: Configured for cross-origin requests
- **Plan Restrictions**: Feature gating by subscription tier

### Environment Variables
```bash
DATABASE_URL          # PostgreSQL connection string
NEXTAUTH_SECRET       # JWT signing secret
GOOGLE_CLIENT_ID      # Google OAuth
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID      # GitHub OAuth
GITHUB_CLIENT_SECRET
RESEND_API_KEY       # Email service
OPENAI_API_KEY       # AI form generation
```

### Database Connection
- **Host**: ep-blue-lab-agc5haaw-pooler.c-2.eu-central-1.aws.neon.tech
- **Database**: neondb
- **SSL**: Required
- **Pooler**: Enabled for better connection management

## Key Components

### Public Form System
- **`/app/f/[publicId]/page.tsx`**: Public form submission page
  - No authentication required for submission
  - Handles form validation and submission to API
  - Shows success message or redirects based on form settings

- **`/app/f/[publicId]/public-form-renderer.tsx`**: Separate form renderer
  - Ensures controlled inputs with proper default values
  - Prevents React controlled/uncontrolled input warnings
  - Initializes all form fields with defaults before rendering

### Form Embedding System
- **`/app/embed/[publicId]/page.tsx`**: Embeddable form view
  - Minimal styling for iframe embedding
  - PostMessage communication for resize and events
  - Sends `tinyform-resize`, `tinyform-submitted`, `tinyform-redirect` messages

- **`/components/embed-code-dialog.tsx`**: Embed code generation dialog
  - Three embed options: iframe, JavaScript, direct link
  - JavaScript option includes auto-resize functionality
  - Copy-to-clipboard for all embed codes

### Submissions Management
- **`/app/forms/[formId]/submissions/page.tsx`**: Submissions viewer
  - Table view with pagination (10 per page)
  - Search across all submission data
  - Filter by status (all, processed, pending, failed)
  - Detailed submission view in dialog
  - Export functionality (planned for CSV/JSON)

## Special Considerations

- The project uses path aliases: `@/*` maps to `src/*` (web), `~/*` maps to `src/*` (tinyform-api)
- Forms are persisted to localStorage under key `form-builder-store` (legacy) or API database (new)
- AI generation is rate-limited per IP address
- PostHog analytics are proxied through Next.js rewrites to avoid ad blockers
- Component library is built separately via `bun run build:registry` in web workspace
- Database migrations are handled via Drizzle Kit
- Cloudflare Workers require `nodejs_compat` flag for some libraries
- All timestamps are stored in UTC
- JSONB fields are used for flexible schema storage
- React 19 requires proper initialization of controlled components (all inputs must have initial values)
- Radix UI Select components require non-empty string values (use "all" instead of "")
