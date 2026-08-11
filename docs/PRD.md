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

- **Restart.** Cut from the MVP deliberately. Minecraft has no `restart` command
  — RCON can only send `stop`, so restarting means a process supervisor outside
  the server that notices it died and runs `start.bat` again. That drags in the
  still-undecided deployment question, and it is a different problem from
  everything else in the MVP. Revisit once deployment is settled.
- Player history (UUID, first/last login, kills/deaths, total playtime)
- Alerts / notifications on server down
- Multi-server support
- Search and filtering on logs and player lists
- `op` / `deop` **as a managed feature** — an operator list, controls to promote
  and demote, and a permission model behind them. What is deferred is this
  project taking a position on who may hold that authority. Typing `op` into the
  Console is not that, and is not blocked (2026-08-11)
- Command history persistence
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

**Deployment: back end location decided, public exposure deferred.** The back
end reads `latest.log` off disk and opens a TCP socket to `localhost:25575`, so
it must run as a persistent process on the same machine/network as the
Minecraft server — a serverless host with no filesystem access to that machine
won't work (2026-08-08). This is settled regardless of what comes next, so it
doesn't block `server/` scaffolding.

What's still open: whether to expose that back end publicly (port
forwarding/tunnel/VPS, paired with the Vercel-hosted front end) versus running
everything locally and submitting a recorded demo per Definition of done. That
choice doesn't change any code written before it — it's revisited at the
deployment/wrap-up stage, not now.

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
