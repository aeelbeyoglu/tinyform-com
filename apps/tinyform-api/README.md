# TinyForm API

The backend API for TinyForm built on Cloudflare Workers with PostgreSQL (Neon) and NextAuth.

## Architecture

- **Runtime**: Cloudflare Workers (Edge)
- **Database**: PostgreSQL via Neon
- **ORM**: Drizzle ORM
- **Framework**: Hono
- **Authentication**: NextAuth.js / Auth.js
- **File Storage**: Cloudflare R2
- **Cache**: Cloudflare KV
- **Queue**: Cloudflare Queues

## Getting Started

### Prerequisites

1. Create accounts at:
   - [Cloudflare](https://dash.cloudflare.com/sign-up)
   - [Neon](https://neon.tech)
   - [Resend](https://resend.com) (for emails)

2. Install dependencies:
```bash
bun install
```

### Environment Setup

1. Copy the environment variables template:
```bash
cp .env.example .env.local
```

2. Fill in your credentials in `.env.local`

### Database Setup

1. Create a database in Neon
2. Update `DATABASE_URL` in `.env.local`
3. Run migrations:
```bash
bun run db:push
```

### Development

Start the development server:
```bash
bun run dev
```

The API will be available at `http://localhost:8787`

## API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - Sign up new user
- `POST /api/v1/auth/signin` - Sign in user
- `GET /api/v1/auth/session` - Get current session
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/signout` - Sign out

### Forms
- `GET /api/v1/forms` - List user's forms
- `POST /api/v1/forms` - Create new form
- `GET /api/v1/forms/:id` - Get form details
- `PUT /api/v1/forms/:id` - Update form
- `DELETE /api/v1/forms/:id` - Delete form
- `POST /api/v1/forms/:id/publish` - Publish form
- `POST /api/v1/forms/:id/duplicate` - Duplicate form
- `POST /api/v1/forms/:id/archive` - Archive form

### Public Forms
- `GET /api/v1/public/:publicId` - Get public form
- `POST /api/v1/public/:publicId/submit` - Submit form
- `GET /api/v1/public/:publicId/stats` - Get form stats

### Submissions
- `GET /api/v1/submissions` - List submissions
- `GET /api/v1/submissions/:id` - Get submission
- `DELETE /api/v1/submissions/:id` - Delete submission

### User
- `GET /api/v1/users/me` - Get user profile
- `PUT /api/v1/users/me` - Update profile
- `GET /api/v1/users/me/api-keys` - List API keys
- `POST /api/v1/users/me/api-keys` - Create API key
- `DELETE /api/v1/users/me/api-keys/:id` - Revoke API key

### Analytics
- `GET /api/v1/analytics/forms/:id` - Get form analytics
- `GET /api/v1/analytics/overview` - Get overview

## Database Schema

The database schema is defined in `src/db/schema.ts` and includes:

- **users** - User accounts
- **accounts** - OAuth accounts (NextAuth)
- **sessions** - User sessions (NextAuth)
- **forms** - Form definitions
- **form_submissions** - Form submission data
- **form_templates** - Reusable templates
- **api_keys** - API access keys
- **webhooks** - Form webhooks
- **form_analytics** - Analytics data

## Deployment

### Staging
```bash
bun run deploy:staging
```

### Production
```bash
bun run deploy:production
```

## Testing

Run tests:
```bash
bun run test
```

## Project Structure

```
apps/tinyform-api/
├── src/
│   ├── index.ts          # Main worker entry
│   ├── db/               # Database schema & config
│   ├── lib/              # Shared libraries
│   ├── middleware/       # HTTP middleware
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── types/            # TypeScript types
│   └── utils/            # Utilities
├── drizzle/              # Database migrations
├── wrangler.toml         # Cloudflare config
└── drizzle.config.ts     # Drizzle ORM config
```

## Security

- JWT-based authentication
- API key authentication for programmatic access
- Rate limiting per IP and per user
- CORS configuration
- Input validation with Zod
- SQL injection prevention via parameterized queries

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT