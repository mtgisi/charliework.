# charliework

A small task tracker built for a two-person team that needed something quieter than Asana and less ad-hoc than a shared text file. The app handles a punch list of work with categories, due dates, and an "ask my supervisor" question queue that surfaces in a daily email so nobody has to interrupt anyone in person to get answers.

The system runs on Node, Express, and SQLite, with a React front end served by Vite. Authentication is Google OIDC against an email allowlist set by environment variable, since this is meant to be deployed for a known set of people rather than opened to the public.

## What it does

The base unit is a task. A task carries a title, free-form markdown notes, a due date, an assignee, one or more categories drawn from a configurable set, and a priority slot you control by dragging cards in the open list. Underneath any task you can add subtasks, and each subtask can have its own subtasks, recursively, with the rendering shrinking at each level so the visual hierarchy stays legible. When you spawn a new subtask the title input opens inline rather than dropping you into a modal, which keeps the cost of capturing a small follow-up close to zero.

Two intermediate states sit between open and done. The first is "pending review," for work where your part is finished but you are waiting on a collaborator to sign off; pending tasks float to the top of the list with a soft red gradient and a compact one-line layout, so they are visible without crowding the workspace. The second is "waiting on subtask," which greys the card slightly without striking it through, since the work is not paused in any meaningful sense but is blocked on something concrete in the hierarchy below. Both states clear automatically when the task is checked complete.

There is a third tier called Someday, which the layout treats as a dashed drop zone underneath the active list. Tasks here are explore-ideas rather than commitments, and you can drag them in or out depending on whether they earn promotion to real work or get demoted out of the way. The count of Someday items appears as a small italic chip next to the tab bar, so they remain visible without competing for attention.

The "Ask Supervisor" feature is a per-task question queue. You queue questions during work and they accumulate on each task's detail view, where the other person can answer them in-app. A daily weekday email digest collects all open questions into a single message with deep links back to the relevant tasks, so the supervisor batches their answers instead of being pinged whenever a small ambiguity comes up.

## Stack

- Node 20, Express, better-sqlite3, openid-client, node-cron, nodemailer
- React 18, Vite, react-markdown with GFM
- Google OIDC for authentication, email allowlist for authorization
- Docker Compose, designed to sit behind a reverse proxy

## Configuration

Copy `.env.example` to `.env` and fill in the values you need. The required pieces are a Google OAuth client (the redirect URI must match `https://<BASE_URL>/auth/callback`), a `JWT_SECRET` of about 32 bytes of hex, and at least one user definition. User identity comes from environment variables rather than code, so the source can ship publicly without leaking PII. You can either set `USERS_JSON` for full control over the user map, or use the simpler `USER_A_*` and `USER_B_*` pair for a two-person setup.

If you serve the app from a sub-path rather than a dedicated subdomain, set both `BASE_URL` and `COOKIE_PATH` to the prefix, and confirm that your reverse proxy strips the prefix before forwarding. The Vite `base` setting in `client/vite.config.js` handles the asset prefix on the client side.

The two digests are independent and both default off. The ntfy task digest fires whenever `NTFY_URL` is set, and the SMTP question digest fires whenever `QUESTION_DIGEST_ENABLED=true` along with valid `QUESTION_DIGEST_TO` and SMTP credentials. The question digest works against IP-allowlisted SMTP relays without authentication, which is the common case for an internal Google Workspace relay, but you can also supply `SMTP_USER` and `SMTP_PASS` if your provider requires them.

## Running

```
cp .env.example .env
# edit .env to taste
docker compose up -d --build
```

The container exposes port 3000. Mount a Docker volume at `/app/data` to persist the SQLite database across rebuilds.

## API surface

Routes are grouped by resource. Authentication routes live under `/auth`:

- `GET /auth/login` starts the OAuth flow
- `GET /auth/callback` finishes it
- `POST /auth/logout` clears the session cookie
- `GET /auth/me` returns the current user

Application routes live under `/api`:

- `GET /api/tasks` returns every task, including subtasks (the client groups them by `parent_id`)
- `POST /api/tasks` creates a task, accepting `parent_id` to create a subtask
- `PATCH /api/tasks/:id` updates any subset of fields
- `DELETE /api/tasks/:id` deletes the task and cascades to every descendant
- `POST /api/tasks/reorder` accepts a JSON `{ids: [...]}` list to set top-level priority
- `GET /api/questions`, `POST`, `PATCH /:id`, `DELETE /:id` for the question queue
- `GET /api/shortcuts`, `POST`, `PATCH /:id`, `DELETE /:id` for the date shortcut chips
- `GET /api/digest/preview` shows the JSON body of the next task digest without sending
- `POST /api/digest/send` and `POST /api/questions/digest/send` force-send their respective digests, useful when wiring up SMTP for the first time

## Sorting and visual logic

The open list sorts by, in order: pending review state, pinned state, due date (if within the next two work days), manual priority, and then creation time as a tiebreaker. Subtasks within a parent group sort the same way, so when you flip a subtask into pending review it floats to the top of its sibling group.

Category color is data-driven from the category list, so adding new categories means editing one constant rather than chasing down theme references. When a task carries multiple categories, the background renders as a diagonal gradient across all selected category colors, with a vertical accent stripe blending through the same colors on the left edge. The pending-review state overrides this with a soft red gradient but preserves the category accent stripe, so you can still tell at a glance which work areas a stalled task belongs to.

## Data model

SQLite database at `/app/data/charliework.db`. The schema lives in `server/db.js` and applies migrations idempotently on boot, so upgrading the container is safe with respect to existing data. There is no formal migration tooling because the project is small enough that hand-written `ALTER TABLE` guards remain readable.

## License

MIT, full text in `LICENSE`.
