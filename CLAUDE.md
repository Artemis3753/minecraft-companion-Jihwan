# CLAUDE.md

## Project

A web dashboard for monitoring and managing a Paper Minecraft server remotely
over RCON.

**The back end has started.** `server/` has an Express entry point and a working
RCON client, verified against the live server. `client/` has not been created
yet, and there is still no test runner and no lint setup.

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
- **Syntax help is not a principle violation.** Explaining language mechanics
  (control flow, async/await, event listeners) with generic examples — separate
  from the actual file — is teaching, not writing the feature. The line: explain
  and show isolated examples; the developer types the real line into the file.
  Design decisions (data shape, module boundaries, what gets cached, why a
  library) still require propose-and-wait.
- **Explain the "why" behind any non-obvious choice** — a library, a data shape,
  an error-handling strategy. If the developer can't defend it in an interview,
  it shouldn't be in the repo.
- **Push back on over-engineering.** No abstraction layers, no extra folders, no
  patterns that aren't earned by the current size of the project.
- **Prefer teaching over doing** when the developer is stuck on a concept.
- **Use analogies when asked for a piece-by-piece explanation.** When the
  developer asks to walk through something one part at a time, ground each
  part in a relatable comparison, not just technical description — that's
  what makes it stick.
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
- **The developer writes the commit message.** Supply the raw material — what
  changed, which decision it embodies, what a reader would need to know, what is
  worth leaving out — as notes, not as drafted prose. Never hand over a finished
  message to paste. Git history is read in interviews, and a history written in
  someone else's voice is one the developer cannot speak to. Same boundary as
  code: substance from here, wording from the developer.
  - **Give that material in both Korean and English**, even though it makes the
    reply longer. The conversation is Korean and the message is English, so
    hand over English terms and fragments to assemble — not finished sentences
    to paste. Translating while drafting is where the developer's own wording
    gets lost.
  - **The `Co-Authored-By` trailer records who actually wrote the change**, not
    whatever reads better. It belongs on a commit whose code or prose came from
    here; it does not belong on one the developer wrote alone. Its share should
    fall as the developer writes more, and a history showing that shift is worth
    more than a uniform one. In an interview what protects the developer is
    being able to defend each decision, not a clean-looking trailer list.

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
└── server/
    ├── package.json
    ├── index.js          # entry point — Express app, health check route only so far
    ├── routes/           # empty — API endpoints, including auth, land here next
    ├── services/
    │   └── rconClient.js # cached connection + sendCommand(); log reader lands here next
    ├── .env               # gitignored
    └── .env.example
```

Everything in this tree exists except `client/`. **Update this tree as
directories are created** — it is the current map, and it is what a session
reads first to navigate.

`docs/PRD.md` carries the same tree, but for a different purpose: it records
*why* the structure is this shape (why one repo, why `routes/` is split from
`services/`). That one is a frozen design record; this one tracks reality.

## Commands

| | |
| --- | --- |
| Start the Paper server | run `start.bat` in `c:\mc-test-server` |
| Run the front end | not yet |
| Run the back end | `npm start` in `server/` (reads `server/.env`, listens on `PORT`, default 3001) |
| Tests | not yet — no test runner chosen |
| Lint | not yet — ESLint planned, deliberately deferred |

## Domain context

**RCON** is a stateful, authenticated TCP socket, not a request/response HTTP
API. It authenticates once, then carries many commands, and can drop
mid-session. Keep connection handling in one reusable module; don't open a
socket per request.

**Commands the project itself sends:** `list` (players), `whitelist list|add
<name>|remove <name>`, `stop`. That is the whole set — don't add a button, a
screen, or an endpoint that sends anything else without raising it first.

**The Console is not covered by that list.** It forwards whatever the user types
straight to RCON with no filter, so any command Paper accepts can reach the
server through it — including, but not limited to, the four above. The list
governs what *this project* decides to send; in the Console the user decides.
The boundary is who chose the command, not which command it is (2026-08-11).

Paper strips a leading `/` itself — `/list` and `list` return byte-identical
responses, verified against the live server. Don't add slash handling.

**RCON replies can carry `§` formatting codes.** `help` comes back as
`§e--------- §fHelp: §rIndex (1/23) §e---…` while `list` has none, so they appear
per command, not per connection. `§0`–`§9` and `§a`–`§f` are colours; `§l` `§o`
`§n` `§m` are bold, italic, underline, strikethrough; `§k` scrambles; `§r`
resets. The back end passes them through untouched — the Console renders them as
real colour (2026-08-11). `latest.log` does not carry them.

That rendering turns server text into markup, which is an injection risk: build
it as React elements, never `dangerouslySetInnerHTML`. Player names and chat
reach both the Console and the log viewer, so the text is not trusted input.

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
