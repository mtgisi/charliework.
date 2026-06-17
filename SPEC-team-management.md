# Team Management — Feature Spec

Draft. Not committed. Approve before push.

## Goal

Charliework today assumes two peers. A third pattern is coming: one lead with a rotating bench of contributors who pick up small tasks, ask questions about them, and hand work back when they're stuck or finished. The lead needs to assign work without sitting in a meeting, see what is in flight at a glance, intake the contributors' questions in the same surface where they answer their own boss's questions, and close the loop when contributors mark their portion done. Contributors need a personal view that hides everyone else's noise and tells them what's next, what's blocked on them, and where their pending-review work landed.

The shape is a generic "team" feature, intentionally written so it reads the same for a small staff cohort, a contractor pool, or a student project. Nothing in the data model or UI names the cohort type.

## Borrowed ideas

The spec leans on two prior repos. From `gisikw/knockout`: a richer status vocabulary (`captured`, `routed`, `blocked`, `in_progress`, `resolved`), explicit task dependencies, the "ready queue" concept where only actionable work surfaces in default views, and bounded automation knobs so the digest cannot accidentally fan out to a hundred messages. From `gisikw/punchlist`: hashtag routing in quick-add (`#category` re-files instantly), structured decision tickets where a question carries enumerated options and a recommended choice instead of free text, and the discipline of one `INVARIANTS.md` file listing constraints contributors must not break. None of this is copied verbatim; each piece is taken because it solves a real problem the team-management feature introduces.

## Phases

The work breaks into three phases. Phase one is enough to start managing a team. Phases two and three are nice once the first cohort is on the system.

### Phase 1: members, assignment, intake

Three tables get added: `members`, `member_questions`, and a thin `assignments` join. A member carries a label, an avatar (or initials fallback), an optional email for the digest, an active flag, and a free-text role string. Members are not full users; they do not log in. Assignment is many-to-one from task to member, replacing the existing `assignee` string field for tasks that have a member assignee, while still allowing `matt`, `ben`, and `together` as before. The default Open tab gains a member filter chip row above the existing category filter.

Each task in the modal grows a small "Assigned to" section showing the member's avatar and label. Below it sits an "Intake from member" block, structurally identical to the existing "Ask Supervisor" block but inverted: the member asks the lead a question about the task, the lead answers, and the answered question stays attached for context. Intake questions cascade-delete with their task, matching the existing behavior for supervisor questions.

A new tab in the top bar, "Team," lists members in a grid. Clicking a member opens a side panel showing every task they are assigned to grouped by status, every open question they have raised, and a count of pending-review tasks waiting on the lead's approval. The panel is read-only for now; CRUD on the member record stays in a settings modal accessed from the user menu.

### Phase 2: status vocabulary, dependencies, ready queue

The task status field expands beyond `open` and `done` to also include `blocked` and `in_progress`. The existing `awaiting_review` and `awaiting_subtask` flags remain orthogonal, since they describe why a task is parked rather than what stage of work it is in. A new `blocked_by` column holds a JSON array of task ids that must reach `done` before the current task is actionable. When every blocker resolves, the blocked task surfaces in a new "Ready" pseudo-tab that is just a filtered view of the open list, sorted by member then by due date.

In practice this lets the lead pre-stage work for contributors during a planning session, mark each task `blocked_by` the prerequisite, and the contributor's personal view stays clean until the prerequisite clears. The "Waiting on subtask" flag becomes redundant for hierarchical cases and gets quietly subsumed by the new dependency model, with a one-shot migration that converts the flag into an explicit subtask dependency on save.

### Phase 3: structured questions, hashtag routing, invariants doc

Intake questions and supervisor questions both gain optional structure: the asker can attach two to four enumerated options and mark one as recommended. The answerer picks an option in one click instead of writing prose; the original free-text path still works for genuinely open questions. The reading order in the modal puts structured questions first since they are faster to clear.

Quick-add gains hashtag routing. Typing `#robotics finish wiring diagram` in the composer creates a task with the Robotics category preselected; `#matt #personal renew driver license` assigns to Matt and adds the Personal category. Member names also route, so `#alex` assigns to a member named Alex if exactly one match exists. Unknown hashtags fall through as plain text rather than failing.

Finally, the repo gains an `INVARIANTS.md` file at the root listing the rules that should not drift: status sort order, color palette hex codes, the "no destructive operation without an undo or explicit confirm" rule, the cap on automated message volume per digest, and so on. Contributors and AI assistants reading the repo get a single source of truth for these constraints, separate from the README's user-facing description.

## Data model summary

```
members(id, label, role, email, avatar_url, active, created_at)
member_questions(id, member_id, task_id, body, options_json, recommended_option,
                 answer, status, asked_at, answered_at)
tasks.assignee_member_id      -- nullable, supersedes string assignee when set
tasks.status                  -- 'open' | 'in_progress' | 'blocked' | 'done'
tasks.blocked_by              -- JSON array of task ids
```

Existing rows stay valid since every new column is nullable or has a sensible default.

## API surface

New routes under `/api/members` and `/api/member-questions` mirror the existing `/api/tasks` and `/api/questions` shape. The `/api/tasks` PATCH endpoint accepts `assignee_member_id`, `blocked_by`, and the expanded `status` values, falling back to current behavior when omitted.

## Non-goals

The feature does not introduce per-member authentication. Members do not log in, do not have personal sessions, and cannot read or write data themselves; the lead operates the system on their behalf. If that changes later, the existing OIDC machinery can extend to cover it, but adding member auth in this round trades clarity for scope.

There is no per-member visibility model beyond filtering. Every member's data is visible to every logged-in lead, which matches how the two-person version already works. A real RBAC layer waits until the user count justifies it.

## Open questions for review

- The "Team" tab placement: top bar alongside Open / Done / Ask Supervisor, or a sidebar that compresses on narrow viewports?
- Should structured-question options be limited to two through four, or allow up to six? Punchlist caps at four; longer lists slow the answer pick.
- For the intake email digest, mirror the existing supervisor digest schedule and bundle both into a single message, or keep them on separate cron entries so the lead can opt one in without the other?
- Members without emails: skip from digest silently, or surface an "unconfigured contact" warning on the member card?
