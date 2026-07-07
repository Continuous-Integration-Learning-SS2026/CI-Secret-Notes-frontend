# Secret Notes — Frontend

Frontend client for **Secret Notes**, a semester project for course S4-CONINT (Continuous Integration). Plain HTML/CSS/JS UI for creating and unlocking encrypted notes, with a PostHog-driven A/B UI toggle (Feature C).

## Stack

- Vanilla JavaScript, HTML, CSS (`src/app.js`, `index.html`, `style.css`)
- Served via nginx in production/Docker
- [PostHog](https://posthog.com/) for the A/B feature toggle (loaded via script tag; `posthog` is a global)
- Jest for unit tests

## What it does

- Create a note: title, content, and an unlock key.
- List existing notes (titles only — content is never shown until unlocked).
- Unlock a note by supplying its key; wrong keys are rejected.
- UI variant is controlled by a PostHog feature flag (Feature C).

Talks to the backend API (`/api/notes`, `/api/notes/unlock`) — see [CI-Secret-Notes-backend](https://github.com/Continuous-Integration-Learning-SS2026/CI-Secret-Notes-backend) for the API contract.

## Local development

Open `index.html` directly, or build/run via Docker:

```bash
docker build -t secret-notes-frontend .
docker run -p 8080:80 secret-notes-frontend
```

Note: the bundled `nginx.conf` proxies `/api/` to a host named `backend` — when running standalone (not as part of the full blue/green stack), you'll need a container/host reachable at that name for API calls to work, e.g. via the top-level `compose.yml`/`docker-compose.prod.yml` in the backend repo.

## Testing

```bash
npm ci
npm test              # Jest
npm run test:coverage # Jest with coverage
npm run lint           # ESLint
```

## Production deployment (blue/green)

This repo doesn't own deploy/infra — that lives in `CI-Secret-Notes-backend`, which expects this repo checked out as a **sibling directory** on the EC2 host:
Deploys run from the backend repo (`docker compose -f docker-compose.prod.yml up -d frontend-green`, etc.) — see that repo's README for the full deploy flow.

## CI/CD

Two parallel pipelines, same 6 stages (Lint → Test → Build → Deliver → Deploy → E2E/Performance & Switch):

- **GitHub Actions** — `.github/workflows/frontend-ci.yml`, cloud-hosted.
- **Jenkins** — `jenkins/Jenkinsfile.frontend`, self-hosted on the project's EC2 instance.

`main` runs Lint/Test/Build only. `deploy/production` runs all 6 stages. The E2E/Performance stage checks out `CI-Secret-Notes-backend`'s `e2e/` folder (Playwright + k6), since that's where those shared tests live.

## Related

- [CI-Secret-Notes-backend](https://github.com/Continuous-Integration-Learning-SS2026/CI-Secret-Notes-backend) — API, and owner of all shared deploy/infra files.