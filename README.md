# Ultimate Blind Test

Real-time blind test web app: a **host** creates a game and shares its code, **players** join from
their phones and answer each round; the host sees every answer **timestamped by the server** and
ranked by arrival.

## Stack

| Layer    | Tech                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces · TypeScript 6 (strict)                                                                           |
| Server   | Node 24 · Fastify 5 · Socket.IO 4 · Zod 4 — hexagonal architecture                                                |
| Web      | React 19 · Vite 8 · React Router 7 · TanStack Query · Zustand · Tailwind 4 + shadcn/ui                            |
| Shared   | `@ubt/shared`: socket event contracts, DTOs, Zod payload schemas                                                  |
| Quality  | Vitest · Testing Library · ESLint (typescript-eslint strict) · Prettier · dependency-cruiser · Husky + commitlint |

## Getting started

```bash
nvm use            # Node 24 (see .nvmrc)
corepack enable    # provides the pinned pnpm version
pnpm install
pnpm dev           # server on :3000, web on :5173 (exposed on your LAN)
```

Open http://localhost:5173, click **Create a game**, then join from another tab or from a phone on
the same network (`http://<your-ip>:5173`) with the displayed code.

## Scripts

| Command          | What it does                                       |
| ---------------- | -------------------------------------------------- |
| `pnpm dev`       | Runs server (tsx watch) and web (Vite) in parallel |
| `pnpm test`      | Unit + integration tests in every package          |
| `pnpm lint`      | ESLint with type-aware rules                       |
| `pnpm typecheck` | `tsc --noEmit` in every package                    |
| `pnpm depcruise` | Fails if a hexagonal layer imports a forbidden one |
| `pnpm build`     | Bundles the server (tsup) and the web app (Vite)   |
| `pnpm verify`    | Everything CI runs                                 |

## Layout

```
apps/server     Fastify + Socket.IO back end (domain / application / infrastructure)
apps/web        React front end (app / features / shared)
packages/shared Contracts shared by both sides
docs/           Architecture notes and ADRs
```

See [docs/architecture.md](docs/architecture.md) for the design and [docs/adr](docs/adr) for the
decisions behind it.

## Manual Deployment

For the manual ElasticBeanStalk deployment, you need to install the [EB CLI](https://github.com/aws/aws-elastic-beanstalk-cli-setup).

Before doing any of these actions, set your AWS credentials with `AWS_PROFILE` or with access keys

Then you init the EB repository : `eb init -p docker ubt-app`.

After you create the EB environment on AWS : `eb create ubt-app`

You'll need to set this as environment variables too for the EB with : `eb setenv MY_VAR=MY_VALUE`
You want to set `WEB_PORT`, `ECR_REGISTRY` and `IMAGE_TAG`

If you want to clean your environment, run : `eb terminate` in your local code
