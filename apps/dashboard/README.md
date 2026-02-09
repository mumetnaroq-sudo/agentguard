# AgentGuard Dashboard

The AgentGuard SaaS Dashboard built with Next.js 14 and Clerk authentication.

## Features

- 🔐 **Secure Authentication** - Email/password + OAuth (GitHub, Google) via Clerk
- 🛡️ **Protected Routes** - Middleware-based route protection
- 👤 **User Profile Management** - Full account settings and profile customization
- 📊 **Dashboard Layout** - Professional admin interface with sidebar navigation
- 🎨 **Dark Theme** - Consistent dark UI matching AgentGuard brand

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Clerk Authentication
- Lucide React Icons

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Clerk account (for auth keys)

### Installation

1. Navigate to the dashboard directory:
```bash
cd apps/dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Update `.env.local` with your Clerk credentials:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key | Yes |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign in page URL | No (default: /sign-in) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign up page URL | No (default: /sign-up) |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Post-signin redirect | No (default: /dashboard) |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Post-signup redirect | No (default: /dashboard) |

## Project Structure

```
app/
├── layout.tsx              # Root layout with ClerkProvider
├── page.tsx                # Landing page
├── globals.css             # Global styles
├── sign-in/[[...sign-in]]/ # Sign in page (Clerk catch-all)
├── sign-up/[[...sign-up]]/ # Sign up page (Clerk catch-all)
└── dashboard/
    ├── page.tsx            # Main dashboard
    └── user-profile/       # User profile settings

components/
└── auth/
    ├── DashboardHeader.tsx  # Dashboard top navigation
    └── DashboardSidebar.tsx # Dashboard sidebar

hooks/
└── useSession.ts          # Session management hooks

lib/
├── auth.ts                # Server-side auth utilities
└── utils.ts               # Utility functions

middleware.ts              # Route protection middleware
```

## Authentication Flow

1. **Landing Page** (`/`) - Public marketing page with CTAs
2. **Sign In** (`/sign-in`) - Email/password or OAuth login
3. **Sign Up** (`/sign-up`) - Account creation with verification
4. **Dashboard** (`/dashboard`) - Protected main dashboard
5. **User Profile** (`/dashboard/user-profile`) - Account settings

## Protected Routes

Routes are protected via `middleware.ts`. Public routes include:
- `/` - Landing page
- `/sign-in/*` - Authentication pages
- `/sign-up/*` - Registration pages
- `/api/webhook/*` - Webhook endpoints
- `/api/public/*` - Public API endpoints

All other routes require authentication.

## Session Management

### Client-side Hooks (`hooks/useSession.ts`)

- `useSessionManager()` - Full session state and user data
- `useAuthorization()` - Role/permission checking
- `useProtectedRoute()` - Route protection check

### Server-side Utilities (`lib/auth.ts`)

- `requireAuth()` - Server-side auth check with redirect
- `getCurrentUser()` - Get current user without redirect
- `isAuthenticated()` - Check auth status
- `getAuthToken()` - Get JWT token for API calls

## Customization

### Clerk Appearance

The Clerk components are themed in `app/layout.tsx` using the `appearance` prop:

```typescript
appearance={{
  baseTheme: dark,
  variables: {
    colorPrimary: "#3b82f6",
    colorText: "#ffffff",
    // ...
  },
  elements: {
    formButtonPrimary: "bg-blue-500 hover:bg-blue-600",
    // ...
  },
}}
```

### Adding New Routes

1. Create the page in `app/dashboard/`
2. Add navigation item in `components/auth/DashboardSidebar.tsx`
3. The route is automatically protected by middleware

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

Build the application:
```bash
npm run build
```

The output will be in `.next/` directory.

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT © AgentGuard
