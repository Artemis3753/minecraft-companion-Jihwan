# CLAUDE.md

## Project

A web dashboard for monitoring and managing a Paper Minecraft server remotely
over RCON.

**The repo is pre-code.** There is no source, no `package.json`, no build
tooling yet. Don't go looking for an implementation; it hasn't been written.

## Absolute rules

Non-negotiable. Everything below this section is guidance; this section is not.

1. **Never write credentials into this repo.** The RCON password and
   management-server secret sit in plaintext in
   `c:\mc-test-server\server.properties`. Read them from there when configuring
   local development and copy them into a gitignored `.env`. Never put those
   values in any file here — including this one, config samples, test fixtures,
   or commit messages. **This repo has a public GitHub remote.**
2. **`.env` stays gitignored.** No hardcoded hosts, ports, or passwords
   anywhere in tracked files.
3. **Destructive commands need explicit confirmation.** `stop` and whitelist
   edits are exposed deliberately by this project — put them behind a
   confirmation step, never a bare click.
4. **Don't write whole features unprompted.** Propose and wait for agreement.
   See Working principles below for why.

## Scope

See `docs/PRD.md` for the MVP feature list, screens, structure, and the
reasoning behind the technical decisions. Treat it as the source of truth for
what's in and out of scope.

Three sections there constrain everyday decisions — check them before proposing
anything new:

- **Definition of done** — the finish line is fixed. Work stops when that list
  is met; anything past it is a separate effort, not "still finishing."
- **Avoiding an API-wrapper project** — reject features that amount to fetching
  a third-party endpoint and rendering the result.
- **Deployment: undecided** — the back end needs filesystem access to
  `latest.log` and a TCP socket to the Minecraft host, so serverless won't work
  as-is. Settle this before writing deployment-specific code.

## Working principles

The point of this project is to demonstrate the developer's own design ability,
not to ship fast. Optimize for the developer understanding every decision, not
for volume of generated code.

- **Don't write whole features unprompted.** For anything substantial, propose
  an approach and wait for agreement before writing code.
- **Skeletons are the developer's job.** File structure, module boundaries, and
  function signatures are the developer's calls. Fill in and review rather than
  architect from scratch.
- **Explain the "why" behind any non-obvious choice** — a library, a data shape,
  an error-handling strategy. If the developer can't defend it in an interview,
  it shouldn't be in the repo.
- **Push back on over-engineering.** No abstraction layers, no extra folders, no
  patterns that aren't earned by the current size of the project.
- **Prefer teaching over doing** when the developer is stuck on a concept.
- **Prompt for the decision log.** When a non-obvious decision gets made — a
  library, a data shape, a cut feature, a trade-off — say so and point at
  `docs/interview-prep.md` (a local, gitignored notebook). Add the *question*
  there; **never write the answer.** The developer writes it in their own words,
  and being unable to is the signal worth catching. This is a job-search
  portfolio: an explanation the developer can't give unaided is a liability.
- **Check that log before every commit.** The prompt above depends on noticing
  the moment, and mid-work that leaks; a commit is an explicit checkpoint that
  doesn't. Before writing the message, ask whether the change embodies a
  decision worth a question.

## Architecture

```
minecraft-companion-jihwan/
├── CLAUDE.md
├── README.md
├── docs/
│   └── PRD.md            # design rationale — source of truth for scope
├── client/               # NOT YET CREATED
│   └── src/
│       ├── pages/        # Login, Dashboard, Console, Whitelist, Logs
│       └── components/   # top tab bar (shared by all views except Login)
└── server/               # NOT YET CREATED
    ├── index.js          # entry point
    ├── routes/           # API endpoints, including auth
    ├── services/         # RCON client, log file reader
    └── .env              # gitignored
```

Only `docs/`, `README.md`, and this file exist today. **Update this tree as
directories are created** — it is the current map, and it is what a session
reads first to navigate.

`docs/PRD.md` carries the same tree, but for a different purpose: it records
*why* the structure is this shape (why one repo, why `routes/` is split from
`services/`). That one is a frozen design record; this one tracks reality.

## Commands

Nothing is installed yet — there is no `package.json` in either half. **Fill
this in as soon as the first npm script exists.** A session that has to guess
how to run the app burns turns doing it.

| | |
| --- | --- |
| Start the Paper server | run `start.bat` in `c:\mc-test-server` |
| Run the front end | not yet |
| Run the back end | not yet |
| Tests | not yet — no test runner chosen |
| Lint | not yet — ESLint planned, deliberately deferred |

## Domain context

**RCON** is a stateful, authenticated TCP socket, not a request/response HTTP
API. It authenticates once, then carries many commands, and can drop
mid-session. Keep connection handling in one reusable module; don't open a
socket per request.

Commands the MVP sends: `list` (players), `whitelist list|add <name>|remove
<name>`, `stop`. That is the whole set — don't add to it without raising it
first.

**There is no `restart` command in Minecraft.** RCON can only send `stop`;
restarting requires a process supervisor outside the server. Restart was cut
from the MVP for that reason — see the Later list in `docs/PRD.md`. Don't
reintroduce it.

**`latest.log` line format**, verified against the live server:

```
[23:23:53] [Server thread/INFO]: Starting minecraft server version 26.2
[HH:mm:ss] [<thread>/<LEVEL>]: <message>
```

Three consequences for the log viewer:

- **No date on the line.** Only a time. The date lives in the rotated filename
  (`2026-08-06-1.log.gz`); `latest.log` is today's. Don't assume a parseable
  timestamp.
- **The thread token varies** — `ServerMain`, `Server thread`,
  `DataConverter MCTypeRegistry init thread`. It contains spaces and slashes are
  not a safe split. Don't assume a fixed token count.
- **Growth is real.** 7.4 KB in six minutes with zero players connected. Read a
  bounded tail, never the whole file.

## Environment

A live Paper server lives outside this repo and is what the dashboard is built
against. It is **not always running** — if RCON connections are refused, start
it before assuming a bug in the client code.

| | |
| --- | --- |
| Location | `c:\mc-test-server` (outside the repo, not version-controlled) |
| Version | Paper `26.2-100-7731202` (Minecraft 26.2) |
| Game port | `localhost:25565` |
| RCON | `localhost:25575`, enabled via `enable-rcon=true` |
| Logs | `c:\mc-test-server\logs\latest.log` |
| Credentials | in that server's `server.properties` — see Absolute rules |
| Plugins | none loaded (only bStats/spark data dirs) |
| Node / npm | `v24.19.0` / `11.17.0` |
| Java | 25 (Amazon Corretto 25.0.4) — for the Paper server only |
| OS | Windows 11, PowerShell |

PowerShell 5.1 has no `&&` operator; chain commands with `;` or `if ($?) { ... }`.

## Conventions

- **Stick to the stack and structure in `docs/PRD.md`** — React front end,
  Node/Express back end, `client/` and `server/` side by side. The PRD records
  *why* each was chosen; don't substitute alternatives without raising it first.
- **Naming:**
  - `camelCase` for variables, functions, and object properties.
  - `PascalCase` for React components and their files — `Dashboard.jsx`.
  - `camelCase` for every other file — `rconClient.js`, not `rcon-client.js`,
    so the filename matches the identifier it exports.
  - `UPPER_SNAKE_CASE` only for `.env` keys — `RCON_PASSWORD`. That's the
    format's convention, not ours.
- **JSON payload keys are `camelCase`** on both sides of the wire. Client and
  server are both JavaScript, so a naming translation layer would be pure cost.
- **API routes are lowercase, hyphenated** — `/api/server-status`. URLs are
  conventionally lowercase; this is the one place camelCase doesn't apply.
- **Write code comments in Korean** — explain *why*, not *what*. Identifiers,
  commit messages, and repo docs stay in English (matching `.gitignore`, whose
  comments are already Korean).
