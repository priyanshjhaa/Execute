# Execute

Turn plain English into executable actions.

## What is Execute?

Execute is a system where users write business instructions in plain English → Execute converts them into structured steps → runs those steps → and shows exactly what happened.

## Tech Stack

- **Frontend**: Next.js 14+ with TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes, TypeScript
- **Database**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM
- **Queue**: BullMQ with Upstash Redis
- **Auth**: Supabase Auth
- **Monitoring**: Sentry

## Project Structure

```
execute/
├── apps/
│   └── web/                 # Next.js web application
├── packages/
│   ├── db/                  # Database schema and migrations
│   ├── shared/              # Shared types and utilities
│   ├── llm/                 # LLM service (to be added)
│   └── execution-engine/    # Core execution logic (to be added)
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Supabase account

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
cp .env.example .env
```

Edit `.env` and add your Supabase credentials.

4. Set up the database:
```bash
pnpm db:generate
pnpm db:migrate
```

5. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development

### Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm lint` - Run linter
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio

### Monorepo

This is a pnpm workspace monorepo. Each package in `packages/` and `apps/` is a separate workspace.

## License

MIT
