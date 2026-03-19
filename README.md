# Execute

Turn plain English into executable actions.

## What is Execute?

Execute is a system where users write business instructions in plain English → Execute converts them into structured steps → runs those steps → and shows exactly what happened.

## Tech Stack

- **Frontend**: Next.js 16 with TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes, TypeScript
- **Database**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM
- **Auth**: Supabase Auth
- **State Management**: TanStack Query (React Query)
- **Email**: Resend
- **LLM**: Groq SDK, OpenRouter (optional)

## Project Structure

```
execute/
├── apps/
│   └── web/                      # Next.js web application
│       ├── src/
│       │   ├── app/              # Next.js app directory
│       │   ├── components/       # React components
│       │   ├── lib/              # Utilities and configurations
│       │   └── middleware.ts     # Auth middleware
│       └── public/               # Static assets
├── packages/
│   ├── db/                       # Database schema and migrations
│   │   └── src/schema/           # Drizzle schema definitions
│   ├── shared/                   # Shared types and utilities
│   ├── llm/                      # LLM integration and email generation
│   │   ├── src/
│   │   │   ├── action-templates/ # Workflow action templates
│   │   │   ├── email-presets.ts  # Email preset system
│   │   └── structured-email-generator.ts
│   ├── execution/                # Core workflow execution engine
│   │   └── src/
│   │       ├── email/            # Email renderer
│   │       ├── handlers/         # Step handlers (email, Slack, etc.)
│   │       └── executor.ts       # Main execution logic
│   └── validation/               # Workflow validation
│       └── src/
│           ├── step-validators.ts # Step-specific validators
│           └── workflow-validator.ts
└── pnpm-workspace.yaml            # pnpm workspace configuration
```

## Implemented Packages

- **@execute/db**: Database schema with Drizzle ORM
  - User management
  - Workflow definitions
  - Execution tracking
  - User integrations (Slack, Resend, etc.)
  - Contact management
  - Form submissions

- **@execute/shared**: Shared TypeScript types and utilities
  - Common interfaces
  - Utility functions
  - Constants

- **@execute/llm**: LLM integration for workflow generation
  - Workflow generation from natural language
  - Email content generation
  - Preset email templates
  - Structured action classification

- **@execute/execution**: Workflow execution engine
  - Step execution orchestration
  - Email sending (Resend)
  - Slack notifications
  - HTTP requests
  - Task creation
  - Error handling and retries

- **@execute/validation**: Workflow validation
  - Structure validation
  - Integration availability checks
  - Step configuration validation
  - User limit enforcement

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Supabase account
- Resend account (for emails)
- Slack workspace (for Slack integrations)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd execute
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your credentials (see [Environment Variables](#environment-variables) below).

4. Set up the database:
```bash
pnpm --filter db build
```

Then run migrations through Supabase dashboard or use Drizzle Kit:
```bash
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Run migrations
```

5. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Resend (Email)
RESEND_API_KEY=your-resend-api-key

# Slack (Optional - for Slack integrations)
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:3000/api/integrations/slack/callback

# LLM (Optional - for workflow generation)
GROQ_API_KEY=your-groq-api-key
OPENROUTER_API_KEY=your-openrouter-api-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Development

### Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm lint` - Run linter
- `pnpm --filter <package> build` - Build specific package
- `pnpm --filter <package> test` - Test specific package

### Available Scripts

Root package scripts:
- `dev`: Start the web application in development mode
- `build`: Build all packages and the web application
- `lint`: Run ESLint on the web application

### Monorepo

This is a pnpm workspace monorepo. Each package in `packages/` and `apps/` is a separate workspace. Dependencies are linked automatically, and changes in one package are immediately reflected in dependent packages during development.

## Key Features

- **Natural Language Workflow Generation**: Describe what you want in plain English
- **Multi-Step Workflows**: Chain multiple actions together
- **Email Sending**: Integrated with Resend for transactional emails
- **Slack Notifications**: Send messages to Slack channels
- **Form Handling**: Capture and process form submissions
- **Real-time Execution Tracking**: Monitor workflow execution progress
- **Integration Management**: Manage external service connections

## License

MIT
