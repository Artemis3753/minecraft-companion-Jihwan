# CLAUDE.md

## Project

A web dashboard for monitoring and managing a Paper Minecraft server remotely
over RCON.

**The repo is pre-code.** There is no source, no `package.json`, no build
tooling yet. Don't go looking for an implementation; it hasn't been written.

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

## Local test server

A live Paper server lives outside this repo and is what the dashboard is built
against.

| | |
| --- | --- |
| Location | `c:\mc-test-server` (outside the repo, not version-controlled) |
| Version | Paper `26.2-100-7731202` (Minecraft 26.2) |
| Runtime | Java 25 (Amazon Corretto 25.0.4) |
| Start | run `start.bat` from that directory — `java -Xmx2G -jar paper-xxx.jar nogui` |
| Game port | `localhost:25565` |
| RCON | `localhost:25575`, enabled via `enable-rcon=true` |
| Credentials | in that server's `server.properties` — see below |
| Plugins | none loaded (only bStats/spark data dirs) |

The server is **not always running.** If RCON connections are refused, start it
with `start.bat` before assuming a bug in the client code.

### Credentials

The RCON password and management-server secret sit in plaintext in
`c:\mc-test-server\server.properties`. Read them from there when configuring
local development, and copy them into a gitignored `.env`.

**Never write those values into any file in this repo** — including this one,
config samples, test fixtures, or commit messages. This repo has a public
GitHub remote.

## Toolchain

- Node `v24.19.0`, npm `11.17.0`
- Java 25 (Corretto) — for the Paper server only
- Windows 11, PowerShell

PowerShell 5.1 has no `&&` operator; chain commands with `;` or `if ($?) { ... }`.

## Conventions

- **Secrets come from `.env`**, which is gitignored and must stay that way. No
  hardcoded hosts, ports, or passwords.
- **Stick to the stack and structure in `docs/PRD.md`** — React front end,
  Node/Express back end, `client/` and `server/` side by side. The PRD records
  *why* each was chosen; don't substitute alternatives without raising it first.
- **RCON is a stateful, authenticated TCP socket**, not a request/response HTTP
  API. It must authenticate before use and can drop mid-session. Keep
  connection handling in one reusable module; don't open a socket per request.
- **Guard destructive commands.** `stop`, `restart`, and whitelist edits are
  deliberately exposed by this project — put them behind an explicit
  confirmation step, not a bare click.
- **Write code comments in Korean** — explain *why*, not *what*. Identifiers,
  commit messages, and repo docs stay in English (matching `.gitignore`, whose
  comments are already Korean).
