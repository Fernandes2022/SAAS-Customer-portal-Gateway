# Gateway Service - SaaS Backend API

Express + Prisma + BullMQ backend handling authentication, multi-platform channels, upload queuing, real-time updates, billing, and provider integrations.

## 🚀 Quick Start

```bash
cd gateway
pnpm install
pnpm prisma:generate

# Create .env
cp ../.env.example .env
# Edit .env with your values

# Run migrations
pnpm prisma:migrate

# Start server
pnpm dev
```

- Server listens on **PORT** (default: 4000)
- WebSocket server on same port
- BullMQ falls back to in-memory if Redis not configured

## ✨ Features

### Core Services
- 🔐 **Authentication** - JWT-based auth with signup/login
- 🎧 **Multi-Platform Channels** - Connect 10 platforms with OAuth/manual verification
- 📤 **Upload Queue** - BullMQ-powered async job processing
- 🔄 **Real-time Updates** - Socket.IO for live job status
- 💳 **Billing** - Stripe integration with webhooks
- 📊 **Metrics** - Dashboard analytics and usage tracking
- 👥 **Admin Panel** - User management and monitoring
- 🔒 **Encryption** - AES-256-GCM for sensitive tokens

### Platform Support (10 Total)
1. **YouTube** - OAuth2 + API v3 (concrete implementation)
2. **Spotify** - OAuth2 stub (Phase 2)
3. **Apple Music** - API stub (Phase 2)
4. **Deezer** - OAuth2 stub (Phase 2)
5. **SoundCloud** - OAuth2 stub (Phase 2)
6. **TuneIn** - Manual connection stub (Phase 2)
7. **Amazon Music** - API stub (Phase 2)
8. **iHeartRadio** - API stub (Phase 2)
9. **Audiomack** - OAuth2 stub (Phase 2)
10. **Podchaser** - OAuth2 stub (Phase 2)

### Plan-Based Limits
- **Free Plan**: 2 platforms, 2 uploads/month
- **Pro Plan**: 5 platforms, 50 uploads/month
- **Agency Plan**: 10 platforms, unlimited uploads

## 🛠️ Requirements

- **Node.js** >= 20
- **PostgreSQL** (for Prisma)
- **Redis** (optional; for BullMQ production queue)
- **Stripe Account** (optional; for billing)

## 📦 Architecture

### Directory Structure
```
gateway/
├── src/
│   ├── controllers/          # Request handlers
│   │   ├── auth.controller.ts
│   │   ├── channels.controller.ts
│   │   ├── uploads.controller.ts
│   │   ├── billing.controller.ts
│   │   ├── metrics.controller.ts
│   │   └── admin.controller.ts
│   ├── services/             # Business logic
│   │   ├── plan.service.ts   # Plan limits & enforcement
│   │   ├── channels.service.ts
│   │   ├── uploads.service.ts
│   │   ├── billing.service.ts
│   │   ├── metrics.service.ts
│   │   ├── email.service.ts
│   │   ├── crypto.service.ts
│   │   └── providers/        # Platform integrations
│   │       ├── youtube.ts
│   │       ├── generic.ts
│   │       ├── rss.ts
│   │       ├── bootstrap.ts
│   │       └── types.ts
│   ├── routers/              # Express routes
│   │   ├── auth.router.ts
│   │   ├── channels.router.ts
│   │   ├── uploads.router.ts
│   │   ├── billing.router.ts
│   │   ├── metrics.router.ts
│   │   └── admin.router.ts
│   ├── middleware/           # Express middleware
│   │   ├── auth.ts           # JWT verification
│   │   ├── rateLimit.ts      # Plan-based rate limiting
│   │   └── errorHandler.ts
│   ├── queue.ts              # BullMQ setup & workers
│   ├── realtime.ts           # Socket.IO setup
│   ├── server.ts             # Express app creation
│   ├── index.ts              # Entry point
│   ├── prisma.ts             # Prisma client
│   └── env.ts                # Environment validation
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
└── package.json
```

### Request Flow
```
Client Request
    ↓
Express Server (server.ts)
    ↓
Router (routers/*.ts)
    ↓
Middleware (auth, rate limit)
    ↓
Controller (controllers/*.ts)
    ↓
Service (services/*.ts)
    ↓
Database (Prisma) / Queue (BullMQ) / Provider API
    ↓
Response / WebSocket Event
```

## 🔌 API Endpoints

### Authentication (`/auth`)
- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token

### Channels (`/api/v1/channels`)
- `GET /api/v1/channels` - List user's connected channels
- `POST /api/v1/channels/connect` - Connect new platform
- `POST /api/v1/channels/refresh-all` - Refresh all channels
- `POST /api/v1/channels/:id/refresh` - Refresh single channel
- `DELETE /api/v1/channels/:id` - Disconnect channel

### Uploads (`/api/v1/upload`)
- `POST /api/v1/upload` - Schedule new upload job
- `POST /api/v1/upload/presign` - Get presigned upload URL

### Status (`/api/v1/status`)
- `GET /api/v1/status/:jobId` - Get job details and progress

### Metrics (`/api/v1/metrics`)
- `GET /api/v1/metrics/overview` - Dashboard metrics bundle
  - Platforms connected (count/limit)
  - Uploads this month (used/quota)
  - Localization jobs (queued/running/succeeded/failed)
  - Storage used (bytes/limit)

### Billing (`/api/v1/billing`)
- `GET /api/v1/billing/plan` - Get current plan and usage
- `POST /api/v1/billing/checkout` - Create Stripe checkout session
- `POST /api/v1/billing/portal` - Create Stripe customer portal session
- `POST /webhook/stripe` - Stripe webhook handler (raw body)

### Admin (`/admin`)
- `GET /admin/users` - List all users
- `GET /admin/jobs` - List all jobs
- `GET /admin/stats` - Platform statistics

### Health (`/health`)
- `GET /health` - Health check with DB, Redis, queue depth

## 🔐 Environment Variables

### Required (Minimum)
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=random_32+_character_secret_key_here
ENCRYPTION_KEY=32+_chars_for_aes_gcm_encryption_____
WEBSOCKET_PUBLIC_URL=http://localhost:4000
```

### Optional (Recommended for Production)
```env
# Core
PORT=4000
JWT_ISSUER=customer-portal
JWT_AUDIENCE=customer-portal-clients
FRONTEND_BASE_URL=http://localhost:3000

# Queue (Redis)
REDIS_URL=redis://localhost:6379

# Billing (Stripe)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Admin Bootstrap
ADMIN_EMAIL=owner@example.com
ADMIN_VIEWER_EMAIL=viewer@example.com

# Storage (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_BUCKET=uploads

# Providers (YouTube OAuth)
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=http://localhost:4000/oauth2/callback/youtube

# Email (Gmail for password reset)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
```

## 🗄️ Database Schema

### Core Models
- **User** - User accounts with JWT auth
- **Plan** - Subscription tiers (Free/Pro/Agency)
- **PlanUsage** - Monthly usage tracking
- **Channel** - Connected platform channels
- **Job** - Upload jobs with status tracking
- **WebhookEvent** - Idempotent webhook processing
- **PasswordResetToken** - Secure password reset flow

### Key Relationships
```
User
  ├─> Plan (subscription tier)
  ├─> Channels[] (connected platforms)
  ├─> Jobs[] (upload jobs)
  └─> PlanUsage[] (monthly usage)

Channel
  ├─> User (owner)
  └─> Jobs[] (uploads to this channel)

Job
  ├─> User (creator)
  └─> Channel (target platform)
```

### Plan Limits Enforcement

**Channel Limits** (`src/services/plan.service.ts`):
```typescript
await PlanService.ensureWithinChannelLimit(userId);
// Throws 403 if user has reached plan's channelLimit
```

**Upload Limits**:
```typescript
await PlanService.ensureWithinLimits(userId);
// Throws 403 if user has reached plan's uploadQuota for current month
```

## 📤 Upload Flow (Detailed)

1. **Client Request**: `POST /api/v1/upload`
   ```json
   {
     "channelId": "uuid",
     "assetUrl": "https://...",
     "title": "My Video",
     "description": "Optional",
     "platform": "youtube",
     "scheduledAt": "2025-10-25T12:00:00Z"
   }
   ```

2. **Service Layer** (`uploads.service.ts`):
   - Validates channel ownership
   - Checks plan upload limits
   - Creates Job record (status: QUEUED)
   - Enqueues to BullMQ

3. **Queue Worker** (`queue.ts`):
   - Picks job from queue
   - Updates status to RUNNING
   - Emits WebSocket event `job:update`
   - Calls provider's `scheduleUpload()`
   - Updates status to SUCCEEDED/FAILED
   - Emits `job:done` or `job:failed`
   - Increments user's monthly upload count

4. **Real-time Updates** (`realtime.ts`):
   - Client receives WebSocket events
   - UI updates job progress automatically

## 🔄 Provider Integration

### Creating a New Provider

1. **Implement ProviderClient** (`src/services/providers/types.ts`):
```typescript
export interface ProviderClient {
  connect(input: { providerChannelId: string; displayName?: string }): Promise<{
    displayName: string;
    meta?: unknown;
    refreshToken?: string;
  }>;
  
  refresh(channel: ChannelLike): Promise<{
    meta?: unknown;
    status?: ChannelStatus;
    refreshToken?: string;
  }>;
  
  disconnect(channel: ChannelLike): Promise<void>;
  
  scheduleUpload(args: {
    channel: ChannelLike;
    job: { assetUrl: string; title: string; description?: string; scheduledAt: string };
  }): Promise<void>;
}
```

2. **Register in Bootstrap** (`src/services/providers/bootstrap.ts`):
```typescript
import { MyNewProvider } from './mynewprovider';

export function initProviders() {
  // ... existing providers ...
  registerProvider('mynewprovider', new MyNewProvider());
}
```

### Existing Providers

**YouTube** (`src/services/providers/youtube.ts`):
- Full OAuth2 implementation
- Uses Google APIs client library
- Uploads via YouTube Data API v3
- Stores encrypted refresh tokens

**Generic** (`src/services/providers/generic.ts`):
- Fallback provider for stubs
- No-op implementations
- Used for: Spotify, Apple Music, Deezer, SoundCloud, TuneIn, Amazon Music, iHeartRadio, Audiomack, Podchaser

**RSS** (`src/services/providers/rss.ts`):
- Stores RSS feed URL
- No upload capability (read-only)

## 💳 Stripe Integration

### Setup
1. Create Stripe account at https://stripe.com
2. Get API keys from Dashboard → Developers
3. Create Products and Prices
4. Map price IDs to Plans in database

### Webhook Flow
1. User subscribes via Stripe Checkout
2. Stripe sends webhook to `/webhook/stripe`
3. `BillingService.handleWebhook()` processes event
4. Idempotency via `WebhookEvent` table
5. User's `planId` updated automatically

### Events Handled
- `checkout.session.completed` - New subscription
- `customer.subscription.updated` - Plan change
- `customer.subscription.deleted` - Cancellation

## 🔌 WebSocket (Socket.IO)

### Server Setup (`src/realtime.ts`)
```typescript
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  // Verify JWT and attach user info
});

io.on('connection', (socket) => {
  socket.join(`user:${userId}`);
});
```

### Emitting Events
```typescript
import { emitToUser } from './realtime';

emitToUser(userId, 'job:update', { 
  jobId, 
  status: 'RUNNING', 
  progress: 50 
});
```

### Events Emitted
- `job:update` - Progress updates (1-99%)
- `job:done` - Job completed (100%)
- `job:failed` - Job failed

## 🔒 Security

### Encryption
- **Refresh Tokens**: AES-256-GCM encryption via `CryptoService`
- **Passwords**: bcrypt hashing (rounds: 12)
- **JWTs**: HS256 signing with `JWT_SECRET`

### Rate Limiting
Plan-based rate limiting via `rateLimitByPlan()` middleware:
- Tracks requests per user per window
- Higher limits for paid plans
- Returns 429 on limit exceeded

### CORS
Configured to allow frontend origin in production

### Validation
- Zod schemas for all request bodies
- Prisma unique constraints
- JWT expiration (30 days default)

## 🚀 Deployment (Render)

### Prerequisites
1. PostgreSQL database (Render Postgres or external)
2. Redis instance (Upstash recommended)
3. Stripe account with webhook configured

### Render Deployment

**1. Push Gateway to GitHub**
```bash
git add gateway/
git commit -m "Add gateway"
git push
```

**2. Create Web Service on Render**
- Go to https://dashboard.render.com
- New → Web Service
- Connect your GitHub repo
- Configure:
  - **Name**: saas-gateway
  - **Root Directory**: `gateway`
  - **Environment**: Docker
  - **Plan**: Starter or higher
  - **Dockerfile Path**: `gateway/Dockerfile`

**3. Add Environment Variables**
Set all variables from `.env.example` in Render dashboard:
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
ENCRYPTION_KEY=...
REDIS_URL=redis://...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
FRONTEND_BASE_URL=https://your-app.vercel.app
WEBSOCKET_PUBLIC_URL=https://saas-gateway.onrender.com
```

**4. Add Build Command** (if not using Dockerfile)
In Render dashboard, set:
- Build Command: `pnpm install && pnpm prisma:generate && pnpm build`
- Start Command: `pnpm prisma:deploy && pnpm start`

**5. Deploy**
Click "Create Web Service" - Render will build and deploy automatically

**6. Configure Stripe Webhook**
- Endpoint: `https://saas-gateway.onrender.com/webhook/stripe`
- Events: `checkout.session.completed`, `customer.subscription.*`
- Copy webhook secret to Render environment variables

**7. Verify Health**
```bash
curl https://saas-gateway.onrender.com/health
```

### Rollback
Render keeps previous deployments - click "Rollback" in dashboard to restore previous version

## 🧪 Development

### Commands
```bash
pnpm dev              # Start dev server with hot reload
pnpm build            # Build for production
pnpm start            # Start production server
pnpm typecheck        # TypeScript type checking
pnpm prisma:generate  # Generate Prisma client
pnpm prisma:migrate   # Run migrations (dev)
pnpm prisma:deploy    # Run migrations (prod)
pnpm prisma:studio    # Open Prisma Studio
```

### Testing Workflow
1. Start PostgreSQL (local or Docker)
2. Run migrations: `pnpm prisma:migrate`
3. Start Redis (optional): `docker run -p 6379:6379 redis`
4. Start server: `pnpm dev`
5. Test with frontend or Postman

### Postman Collection
Import `src/postman_collection.json` for pre-configured requests

### OpenAPI Spec
View `src/openapi.yaml` for API documentation

## 🐛 Troubleshooting

**Database Connection Failed**:
- Verify `DATABASE_URL` is correct
- Check PostgreSQL is running
- Ensure migrations are up to date

**Queue Not Processing**:
- If Redis configured: Check `REDIS_URL` and Redis connection
- If in-memory: Restart server (queue state resets)
- Check logs for worker errors

**WebSocket Not Connecting**:
- Verify `WEBSOCKET_PUBLIC_URL` matches server
- Check JWT is valid and not expired
- CORS must allow frontend origin

**Stripe Webhooks Failing**:
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check webhook endpoint is publicly accessible
- Review Stripe dashboard for webhook delivery status

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:4000/health
```

Response:
```json
{
  "status": "ok",
  "db": "connected",
  "redis": "connected",
  "queueDepth": 5,
  "websocket": "active"
}
```

### Logging
- Uses `pino` logger (JSON format)
- Logs requests, errors, queue events
- Production: Integrate with Sentry via `SENTRY_DSN`

## 📄 License

Proprietary - All rights reserved

## 🙏 Credits

Built with:
- [Express](https://expressjs.com/)
- [Prisma](https://www.prisma.io/)
- [BullMQ](https://docs.bullmq.io/)
- [Socket.IO](https://socket.io/)
- [Stripe](https://stripe.com/)
- [Google APIs](https://developers.google.com/)
