# Charliework API Reference

This document describes the HTTP interface an external service or agent uses to interact with a Charliework deployment. It complements the README, which covers the human-facing app; here the focus is what a program needs to know to authenticate, read state, and write changes without a browser session.

## Base URL and transport

Every request goes to your deployment's public origin. If Charliework runs at the root of a domain, endpoints look like `https://charliework.example.com/api/tasks`. If it runs under a sub-path (the recommended setup for shared subdomains), prefix every path with that segment: `https://example.com/charliework/api/tasks`. All responses are JSON. All request bodies are JSON with `Content-Type: application/json`, and non-idempotent verbs (`POST`, `PATCH`, `DELETE`) expect a body even when it is empty.

## Authentication

The API supports two authentication modes. Browsers use a session cookie set by the Google OIDC login flow. Other services should use API keys, which are bearer tokens minted by a signed-in user.

An API key request sets the `Authorization` header:

```
Authorization: Bearer cw_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Keys are minted through the app UI at `Account menu → API keys…`. The full plaintext is displayed exactly once at creation, then only the SHA-256 hash is kept server-side, so the plaintext must be stored somewhere durable at the moment it is shown. Keys can be labeled and marked inactive from the same modal. Deleting a key is permanent.

Keys have full read/write access to `/api/tasks`, `/api/questions`, `/api/shortcuts`, `/api/members`, and `/api/member-questions`, but they cannot access `/api/api-keys` itself. This is intentional: a compromised key cannot mint additional keys or lock the owner out. Key management stays behind cookie auth exclusively.

On every request, the server updates `last_used_at` and `last_used_ip` on the key row. If the key is invalid, expired (via `active = 0`), or unrecognized, the server returns `401 Unauthorized`.

## Data model

There are five primary resources. The relationships are worth internalizing before writing code against them.

**Tasks** are the base unit of work. Every task has an assignee handle drawn from the `USERS_JSON` / `USER_A_EMAILS` env-configured list (plus the always-available `together`), zero or more categories, and an optional parent task. Subtasks are just tasks with `parent_id` set; nesting is recursive with no depth limit. When a task is deleted the server cascades to every descendant.

**Questions** are the classic "ask my supervisor" queue. Each question can attach to a task (via `task_id`) or float free. Questions carry an `answer` field that stays empty until someone responds, at which point `status` flips to `answered`.

**Members** represent people you manage (formerly modeled around a single supervisor; now generalized). Members are not authentication principals; they are labels with optional contact info. A task can be assigned to a member via `assignee_member_id` in addition to (or instead of) the account-level `assignee` handle.

**Member questions** are the per-member equivalent of the Ask Supervisor queue: questions that are addressed to a specific member. Unlike free-text questions, member questions can carry multiple-choice `options` and a `recommended_option` index. The person answering picks a `selected_option` and can also write a free-form `answer`.

**Date shortcuts** are the editable chips that appear above every date picker in the UI. They are shared across all users on the instance.

## Response conventions

Success responses return either the created/updated object, an array of objects, or `{ok: true}` for endpoints that have nothing meaningful to return. Errors return `{error: "message"}` alongside an appropriate HTTP status. Validation failures use `400`, missing rows use `404`, and auth failures use `401`.

Timestamps are Unix seconds (`INTEGER` in SQLite). Dates on tasks and shortcuts are ISO `YYYY-MM-DD` strings. Boolean flags in the DB are stored as `0`/`1` and returned as JavaScript booleans in the JSON output.

## Tasks

`GET /api/tasks` returns every task in the system, top-level tasks and subtasks together. The client groups them by `parent_id`; you should do the same if you want the tree. Open tasks come first sorted by `awaiting_review DESC, pinned DESC, due date within two work days, priority ASC, created_at DESC`, followed by done tasks sorted by `completed_at DESC`.

A task object looks like:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Update landing page copy",
  "notes": "See markdown notes stored here",
  "additional_notes": "",
  "status": "open",
  "priority": -3,
  "pinned": false,
  "awaiting_review": false,
  "awaiting_subtask": false,
  "due_date": "2026-07-15",
  "assignee": "user_a",
  "assignee_member_id": null,
  "category": "tech,personal",
  "tier": "normal",
  "parent_id": null,
  "created_by_email": "you@example.com",
  "created_at": 1751000000,
  "updated_at": 1751000000,
  "completed_at": null,
  "is_due_soon": true,
  "is_overdue": false
}
```

`category` is a comma-separated string of category slugs, valid values being `tech`, `biz_comp`, `esports`, `robotics`, `st_croix`, `ultimate`, `personal`. `tier` is `normal` or `someday`. `assignee` must match a handle exposed by the users config; unknown values are silently rejected and fall back to the deployment default.

`POST /api/tasks` creates a task. The body accepts every field in the object above except `id`, timestamps, and the derived `is_due_soon` / `is_overdue` flags. Any field you omit takes its default. Set `parent_id` to make the new row a subtask of an existing task; the server verifies the parent exists and silently drops an invalid reference.

`PATCH /api/tasks/:id` accepts a subset of fields and updates them. If you flip `status` to `done`, the server automatically clears `awaiting_review` and `awaiting_subtask` and sets `completed_at`. If you flip a done task back to `open`, `completed_at` is cleared.

`DELETE /api/tasks/:id` removes the task and every descendant subtask in a single transaction. It also unlinks any questions or member_questions that were attached to those tasks.

`POST /api/tasks/reorder` accepts `{ids: [...]}` and rewrites the `priority` field of the top-level open tasks in the order supplied. This is how drag-and-drop priority changes are persisted. Subtasks are not reorderable through this endpoint; they sort by status and creation time within their parent.

## Questions

`GET /api/questions` returns every question with the associated `task_title` joined in when there is one. Questions sort by status (open first) then `created_at DESC`.

```json
{
  "id": "...",
  "body": "Should we back-port the fix to 2.4?",
  "context": "Optional additional detail",
  "task_id": null,
  "task_title": null,
  "status": "open",
  "answer": "",
  "asked_by": "user_a",
  "answered_by": null,
  "created_at": 1751000000,
  "updated_at": 1751000000,
  "answered_at": null
}
```

`POST /api/questions` accepts `{body, context?, task_id?}`. The `asked_by` field is set from the caller's handle automatically.

`PATCH /api/questions/:id` accepts any of `body`, `context`, `answer`, `task_id`, and `status`. When `status` transitions to `answered`, the server stamps `answered_at` and `answered_by`. When it transitions back to `open`, both are cleared.

`DELETE /api/questions/:id` removes the question.

## Members

`GET /api/members` returns active members by default, sorted by `sort_order`. Pass `?all=1` to include inactive rows (they come last).

```json
{
  "id": "...",
  "label": "Alex Rivera",
  "role": "Front-end lead",
  "email": "alex@example.com",
  "avatar_url": "",
  "active": true,
  "sort_order": 0,
  "created_at": 1751000000
}
```

`POST /api/members` accepts `{label, role?, email?, avatar_url?}`. Only `label` is required.

`PATCH /api/members/:id` accepts `label`, `role`, `email`, `avatar_url`, and `active`. Setting `active` to `false` hides the member from the default list but preserves their history; deletes are destructive.

`DELETE /api/members/:id` cascades: it nulls out `assignee_member_id` on any tasks assigned to the member, deletes every member question addressed to them, and removes the member row.

`POST /api/members/reorder` accepts `{ids: [...]}` and rewrites `sort_order`.

## Member questions

`GET /api/member-questions` returns everything with joined `task_title` and `member_label` for convenience. Sort order is status first, then `asked_at DESC`.

```json
{
  "id": "...",
  "member_id": "...",
  "member_label": "Alex Rivera",
  "task_id": "...",
  "task_title": "Update landing page copy",
  "body": "Which framework do you want to build the new dashboard in?",
  "options": ["React", "SvelteKit", "Vanilla JS"],
  "options_json": "[\"React\",\"SvelteKit\",\"Vanilla JS\"]",
  "recommended_option": 0,
  "answer": "React because we already own the ecosystem",
  "selected_option": 0,
  "status": "answered",
  "asked_at": 1751000000,
  "answered_at": 1751000600,
  "updated_at": 1751000600
}
```

`options` is a decoded array supplied for read convenience. `options_json` is the raw storage form. When you write via `POST` or `PATCH`, send `options` as an array; the server serializes it. Send `null` or omit the field to leave options unchanged; send an empty array to clear them.

`POST /api/member-questions` requires `{member_id, body}`. Optional fields: `task_id`, `options` (array of strings), `recommended_option` (integer index). The server verifies that both `member_id` and any supplied `task_id` reference existing rows.

`PATCH /api/member-questions/:id` accepts `body`, `answer`, `selected_option`, `task_id`, `options`, `recommended_option`, and `status`. When `status` becomes `answered`, `answered_at` is stamped. When it reverts to `open`, `answered_at` is cleared.

`DELETE /api/member-questions/:id` removes the question.

## Date shortcuts

`GET /api/shortcuts` returns the ordered list of date shortcut chips.

```json
{
  "id": "...",
  "label": "Start of Q3",
  "date": "2026-07-01",
  "sort_order": 3,
  "created_at": 1751000000
}
```

`POST /api/shortcuts` accepts `{label, date}` where `date` must match `YYYY-MM-DD`. The new row is appended to the end of the sort order.

`PATCH /api/shortcuts/:id` accepts `label` and/or `date`. `date` is re-validated against the format regex.

`DELETE /api/shortcuts/:id` removes the shortcut.

`POST /api/shortcuts/reorder` accepts `{ids: [...]}`.

## Digests

The task and question digests are configured through environment variables and cron; the API exposes only preview and manual-send endpoints for testing.

`GET /api/digest/preview` returns the JSON body that the next scheduled task digest would send without sending anything. This is cookie-auth only.

`POST /api/digest/send` forces the task digest to send now. This is cookie-auth only.

`POST /api/questions/digest/send` forces the question email digest to send now. This is cookie-auth only.

None of these are useful to an external service under normal circumstances; they are documented here so nobody thinks they are missing.

## Rate limiting and idempotency

There is no server-side rate limiting today. A misbehaving client can hammer the API and the only backpressure comes from `better-sqlite3` serializing writes. Design your integration with this in mind: batch writes if you have many, and add retries with exponential backoff on `500`s.

`POST /api/tasks` is not idempotent. If your service crashes mid-request and you do not know whether the write landed, you can `GET /api/tasks` afterward and look for a matching title + `created_at` window rather than re-sending blindly. A future revision may add an `Idempotency-Key` header; check this document again before assuming it exists.

## Example request

Create a subtask under an existing task, assign it to a member, tag it with two categories, and give it a due date:

```
curl -X POST https://charliework.example.com/api/tasks \
  -H "Authorization: Bearer cw_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Draft copy for the new dashboard hero",
    "parent_id": "550e8400-e29b-41d4-a716-446655440000",
    "assignee_member_id": "6e3f...",
    "category": "tech,personal",
    "due_date": "2026-07-15",
    "notes": "## Constraints\n- Under 40 words\n- Include the product name"
  }'
```

The response is the created task object, ready to feed straight back into `PATCH` or `DELETE` as needed.
