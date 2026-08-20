# PRD — Minecraft Server Companion

A web dashboard for monitoring and managing a Paper Minecraft server remotely
over RCON.

## Why this exists

The developer ran Minecraft servers as a teenager — editing `server.properties`,
installing and configuring Bukkit plugins, tuning economy plugin values, reducing
entity counts for performance. Server management at the time meant sitting at the
PC with a console open. This project is the tool that was missing: a browser-based
panel for the routine operations, reachable from anywhere.

Existing tools (e.g. Pterodactyl) solve this well and are worth studying. This is
a deliberate re-implementation to exercise full-stack design, not an attempt to
displace them.

## Scope

### MVP

| Feature | Notes |
| --- | --- |
| Server online/offline status | Green/red indicator |
| Connected players list | Backed by the RCON `list` command |
| Stop server | Styled red; needs an explicit confirmation step |
| Console | Free command input — anything RCON accepts — and the server's reply verbatim. No history persistence yet |
| Whitelist management | List, add, remove |
| Server logs | Full log output, all levels (INFO / WARN / ERROR / CHAT) |
| Authentication | Single shared password. Not a user-account system |

Authentication is in the MVP, not deferred. Console, stop, and whitelist edits are
all destructive and must not be reachable without auth — retrofitting it later
would mean reworking the request path.

**Buttons are shortcuts; the Console is the full surface.** Anything RCON accepts
can be typed into the Console, so a dedicated screen or button exists only where
a command is run often enough to be worth one — status, whitelist, stop. This is
the filter for future features: if a candidate would be used rarely, the Console
already covers it and a control of its own earns nothing (2026-08-11).

### Later

- Player history (UUID, first/last login, kills/deaths, total playtime)
- Alerts / notifications on server down
- Multi-server support
- Search and filtering on logs and player lists
- `op` / `deop` **as a managed feature** — an operator list, controls to promote
  and demote, and a permission model behind them. What is deferred is this
  project taking a position on who may hold that authority. Typing `op` into the
  Console is not that, and is not blocked (2026-08-11)
- Command history persistence. **A cheap version exists**: keeping the last few
  commands in client state and recalling them with the arrow keys needs no
  storage and no API change. Only persisting across reloads is deferred
- **Command autocomplete in the Console** — the parameter dropdown the game
  client shows while typing. Deferred because RCON cannot supply it: that
  dropdown comes from Brigadier's command tree, which the server sends over the
  game protocol at login, and `help <command>` returns only
  `Usage: whitelist` with no subcommands (verified 2026-08-12). Getting the real
  tree would mean speaking the game protocol — effectively implementing a
  Minecraft client — and a hardcoded list would drift with versions and plugins
  while implying the Console only accepts what it lists, which is the opposite
  of what the Console is for
- Live log streaming over WebSocket

## User flow

```
Login  →  Dashboard (default view)  →  top tabs  →  Console / Whitelist / Logs
```

Tabs are the only navigation. There is no sidebar.

## Screens

**Login** — password field, submit button.

**Dashboard** — status indicator, connected players list, and a Stop button, red
to mark it as destructive.

The indicator carries three states, not two: **green** (RCON answered), **red**
(the back end answered but RCON refused the connection — Minecraft is down), and
**grey** (the back end itself did not answer). Collapsing the last two would
report a dead back end as a dead Minecraft server and send you to fix the wrong
machine.

Status and the player list come from one endpoint, not two. A single RCON `list`
call already answers both — a reply means the server is up, and its contents are
the roster — so splitting them would send the same command twice for no gain.

**Console** — command input, response output. Session history and persistence are
out of scope for now.

Input is unrestricted and the reply comes back verbatim. Every other screen
parses RCON's sentences into structures; this one deliberately does not, and that
is what makes it a screen rather than three more buttons.

Minecraft's `§` formatting codes survive that trip, and the Console renders them
as real colour rather than stripping them (2026-08-11). Colour is part of what
the server said — `help` marks its own headings — so removing it would edit the
output while claiming to show it verbatim. The work lands in the client, which
keeps the back end's promise intact: it still returns exactly what RCON gave it.

**Whitelist** — current entries, add field, per-row remove.

**Logs** — terminal-style scrollable view, monospace, unfiltered and ungrouped.
Everything the server emits, verbatim. MVP fetches on demand via API call;
WebSocket streaming comes later.

## Structure

```
minecraft-companion-jihwan/
├── client/
│   └── src/
│       ├── pages/        # Login, Dashboard, Console, Whitelist, Logs
│       └── components/   # top tab bar (shared by all views except Login)
└── server/
    ├── index.js          # entry point
    ├── routes/           # API endpoints, including auth
    ├── services/         # RCON client, log file reader
    └── .env              # gitignored
```

`client/` and `server/` sit side by side in one repo rather than as separate
projects, so the boundary stays visible and history stays in one place.

`routes/` and `services/` are split so that changing how the server talks to
Minecraft doesn't mean touching the HTTP layer. Auth lives in `routes/` — it's
one endpoint, and splitting it out now would be premature.

## Technical decisions

**Web, not mobile.** An earlier plan targeted React Native. Reversed: a URL is
easier to hand to a reviewer than an APK, and a web build exercises front end,
back end, and the protocol layer in one project.

**Secrets in `.env`, not a database.** The MVP manages exactly one server, so a
database buys nothing yet and would require getting password encryption right.
Migrating to per-server records is the natural step when multi-server support
lands.

**Logs read from `latest.log`.** Paper writes every INFO, WARN, ERROR, and chat
line to `logs/latest.log`, which matches the goal of showing everything verbatim.
The back end reads the file directly, which requires it to share a filesystem
with the Minecraft server — a constraint to revisit at deployment. The file grows
without bound; read a bounded tail rather than the whole file.

**RCON, not a plugin.** RCON is built into Paper and needs no server-side code,
keeping the Minecraft server unmodified.

**No restart. Considered and declined (2026-08-20)**, not postponed. Minecraft
has no `restart` command: RCON can only send `stop`, and RCON is served by the
server process itself, so `stop` closes the control channel along with the thing
it controls — nothing is left listening to start it again. It would take a
process supervisor running outside the server, watching for the exit and
re-running `start.bat`. That is a different kind of program, and it would make
this project own the Minecraft server's lifecycle instead of talking to one
someone else runs. A structural limit, not a scheduling one.

**Deployment: the back end must run beside the Minecraft server.** The back
end reads `latest.log` off disk and opens a TCP socket to `localhost:25575`, so
it must run as a persistent process on the same machine/network as the
Minecraft server — a serverless host with no filesystem access to that machine
won't work (2026-08-08). This is settled regardless of what comes next, so it
doesn't block `server/` scaffolding.

**Public exposure: declined (2026-08-20).** The back end runs locally and the
project ships a recorded demo instead. Four properties of the code as it stands
decided it: there is no HTTPS, so the dashboard password would cross the network
in plain text; `POST /api/login` has no attempt limit; an issued token never
expires; and reaching this back end at all is full control of the Minecraft
server, since `POST /api/console` filters nothing. CORS is not a defence against
any of that — it constrains browsers, and an attacker does not need one.

A public URL would also show less than the recording does. Every screen sits
behind the login, so a reviewer following a link sees one password field and
nothing else, while a demo shows all five screens and the polling picking up a
restart on its own. Keeping that URL meaningful would additionally mean running
the Minecraft server 24/7 on a paid host, since the back end must share its
machine.

The decision rests on those four properties, not on a preference. HTTPS, an
attempt limit on login, and token expiry are what would reopen it.

**The API contract was fixed before either side was built.** Endpoints, payload
shapes, and error semantics are recorded in `README.md`, so `client/` and
`server/` are each built against a settled contract rather than against each
other.

## Avoiding an API-wrapper project

A portfolio project that calls someone else's finished REST API and renders the
response demonstrates API integration and little else — the design work was
already done by whoever built the API. This is why the earlier WoW auction
tracker idea was dropped: Blizzard's API returns the data, and the app would
mostly display it.

This project avoids that trap, and should keep avoiding it:

- **RCON is a raw TCP protocol**, not a curated HTTP API — even routed through a
  client library, the app still owns connection lifecycle, session state, and
  reconnection, unlike a REST call that returns a finished response and forgets
  the connection existed.
- **Log parsing is ours.** `latest.log` is unstructured text; deciding what to
  read, how much, and how to present it is a design problem.
- **The HTTP API is designed here, not consumed.** Endpoints, payload shapes, and
  error semantics between `client/` and `server/` are all decisions to defend.

Apply this as a filter on future features: if a candidate feature amounts to
fetching a third-party endpoint and painting the result on screen, it adds
little and probably doesn't belong.

## Definition of done

The project is finished — and work stops — when all of the following are true.
Anything beyond this is a new, separately scoped effort, not "still finishing."

- [ ] All MVP features work against the local Paper server
- [ ] Auth gates every destructive action
- [ ] Deployed and reachable at a URL, or a documented reason why not plus a
      recorded demo
- [ ] `README.md` covers what it is, why it exists, the stack, setup steps, and
      screenshots
- [ ] `README.md` is rewritten in the developer's own words. Sections drafted
      with AI help are fine while building — but the README is the first thing a
      reviewer reads, and a decision record the developer cannot speak in their
      own voice is worth less than the decisions in it. Same reasoning as the
      commit-message rule in `CLAUDE.md`
- [ ] Design decisions and their reasoning are written down (this file, kept
      current)
- [ ] Repo is public, `.env` never committed, history clean of secrets
- [ ] Added to the resume and posted once publicly

Polish, refactors, and Later-list features do not block this list.

## Portfolio intent

This is a job-search portfolio project. Two consequences:

- **Scope discipline over feature count.** A finished, deployed, well-explained
  small app beats an ambitious unfinished one. Reviewers distrust sprawl.
- **Every decision must be defensible in an interview.** If the developer can't
  explain why a library, structure, or trade-off was chosen, it doesn't belong
  in the repo.
