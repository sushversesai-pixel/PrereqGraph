# PrereqGraph

**Learning intelligence** — a Zoho Catalyst app that traces prerequisite dependency graphs to answer the two
questions that matter in education:

- **For students:** *"Am I ready to learn this concept, and what exactly is blocking me?"*
- **For faculty:** *"Is my class ready for this topic, and which foundational gap is blocking the most students?"*

Built with a **Create React App** frontend (`prereqgraph/`) and a **Zoho Catalyst Advanced I/O** backend
(`functions/prereq_graph_function/`, Express + Node SDK).

---

## Two experiences, one app

| | Student Workspace | Faculty Dashboard |
|---|---|---|
| Question | Am I ready? | Is my class ready? |
| Scope | One learner's prerequisite graph | The whole cohort aggregated |
| Modules | Analysis, Learning Paths, Knowledge Map, Insights, Progress, Recommendations | Class Overview, Bottleneck, Student Roster, Class Map, Actions |
| Data | `StudentKnowledge` rows for your user | Every student's `StudentKnowledge` rows |

The experience is driven by the **logged-in user's Catalyst role** (User Management → Roles) — **no profile
table needed**. Users holding a Faculty/Teacher/Instructor/Professor/Admin role get the Faculty Dashboard;
everyone else gets the Student Workspace.

### Demo mode

When the app runs somewhere Catalyst doesn't serve (local previews, sandboxes), it auto-falls back to **demo
mode**: a synthetic 24-student class for the faculty view and a demo learner for the student view. In demo mode
you can switch roles from the profile panel (click your avatar) or the "Try faculty dashboard" button in the demo
banner. Demo mode never touches Catalyst, so no 404s and no credentials needed.

---

## 👤 Roles & identity (pure Catalyst auth — no extra table)

Identity comes entirely from **Catalyst User Management** — the app does **not** use a `Profiles` Data Store
table:

- **Who you are** — `user_id`, `first_name`, `last_name`, `email` come from the authenticated session
  (`userManagement().getCurrentUser()`).
- **Your role** — derived from the user's Catalyst roles (`role_details.role_name`). Any role matching
  `faculty`, `teacher`, `instructor`, `professor`, or `admin` → **faculty**; otherwise → **student**.
- **Roster names** — the faculty dashboard resolves student names via the admin-scoped
  `userManagement().getAllUsers()` API. If the function lacks admin credentials, names fall back to
  `Student <id>`.

### Make yourself faculty (Console)

1. **Catalyst Console → your project → User Management → Roles → + Create Role**.
2. Name it e.g. **`Faculty`** (any name containing "faculty", "teacher", "instructor", "professor", or "admin"
   works).
3. **Add yourself** (and any instructors) to that role.
4. Redeploy (`catalyst deploy`) and sign in — the app auto-detects your role and shows the Faculty Dashboard.

> **Function credentials note:** `getAllUsers()` is admin-scoped. Advanced I/O functions run with the project's
> service credentials, so this typically works out of the box. If roster names show as "Student \<id\>", check the
> function's execution credentials in the console.

---

## 🗄 Catalyst Data Store setup

Create these tables in **Catalyst Console → Data Store** (all pre-existing — **nothing new to create**):

### `Concepts`
| Column | Type | Notes |
|---|---|---|
| `name` | Text | Concept title |
| `description` | Text | Short summary |
| `difficulty` | Number | 1–5 |

`ROWID` is auto-generated and **is** your `concept_id`.

### `Prerequisites`
| Column | Type | Notes |
|---|---|---|
| `concept_id` | Number | The dependent concept's ROWID |
| `prerequisite_id` | Number | The required prerequisite's ROWID |

One row per edge: "concept X requires Y".

### `StudentKnowledge`
| Column | Type | Notes |
|---|---|---|
| `student_id` | Text | **The Catalyst `user_id` of the student** |
| `concept_id` | Number | The concept's ROWID |
| `status` | Text | `Strong` / `Weak` / `Don't Know` |
| `confidence` | Number | 0.0 – 1.0 |

> ⚠️ **Student identity:** `student_id` must equal the student's Catalyst `user_id` (an 18-digit number) — create
> the column as **Text** to avoid precision loss.

---

## 🔌 Backend endpoints

All routes live under `/server/prereq_graph_function/` (Catalyst prefixes `/server/<function_name>`):

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /` | Session (or `student_id` in dev) | Single-student prerequisite analysis: graph, gaps, root cause, knowledge debt, revision path |
| `GET /health` | None | System status for the top-bar indicator |
| `GET /profile` | Session | Current user's identity + role (from Catalyst session, no table) |
| `GET /faculty/cohort?concept_id=X` | Session + **Catalyst role = faculty** | Class readiness %, cohort debt, mastery histogram, bottleneck, impact ranking, 2×2 risk matrix, roster with misconception/imposter flags, class concept map, remediation groups, pacing advice, pre-lecture quiz |

---

## 🚀 Local development & deploy

1. **Install & login**
   ```bash
   npm install -g catalyst-cli
   catalyst login
   ```
2. **Install deps**
   ```bash
   cd prereqgraph && npm install
   cd ../functions/prereq_graph_function && npm install
   ```
3. **Run locally** (serves the client on port 3000 + functions + `/__catalyst/*` auth routes)
   ```bash
   catalyst serve
   ```
   > **Windows / OneDrive:** if `catalyst serve` fails with *"unable to cleanup the .build directory"*, a stale
   > Node process or OneDrive sync is locking `.build`. Close running servers, `taskkill /F /IM node.exe`,
   > `Remove-Item -Recurse -Force .build`, and retry. For good, move the repo outside OneDrive.
4. **Deploy**
   ```bash
   catalyst deploy
   ```
   Your app runs on `https://<domain>.development.catalystserverless.com` — log in via
   `/__catalyst/auth/login`, then the top-bar status turns green and analysis runs against your real Data Store.

### Faculty quick-start checklist
1. Confirm the three tables exist (Concepts, Prerequisites, StudentKnowledge).
2. Create a **Faculty** role in Catalyst User Management and assign yourself to it.
3. Give a few students `StudentKnowledge` rows (their `user_id` as `student_id`).
4. Deploy, sign in as faculty, and open the **Faculty Dashboard** → enter a concept ID → *Analyze Class*.

---

## Available scripts (in `prereqgraph/`)

```bash
npm start        # runs the app (react-scripts start)
npm test         # runs the smoke test
npm run build    # production build into build/
```
