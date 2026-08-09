# Minecraft Server Companion

A web-based dashboard for monitoring and managing a Minecraft (Paper) server remotely via RCON.

## Status

🚧 In development

## Planned Features (MVP)

- Server online/offline status
- View connected players
- Stop server
- Console (execute RCON commands)
- Whitelist management
- Server log viewer
- Authentication (single shared password)

## Tech Stack

- **Frontend**: React
- **Backend**: Node.js, Express
- **Protocol**: RCON (Minecraft Paper server)

## API

In progress — Login, Dashboard, and Whitelist are settled. Console and Logs are
not designed yet.

Every payload key is `camelCase`. Failures always carry the message under
`error`, so a client reads one field regardless of which endpoint failed.

`401` applies to every endpoint that requires a token and is not repeated below:

```
401  { "error": "Token is invalid" }
```

### `POST /api/login`

Exchanges the dashboard password for a token. This is the only endpoint that
issues one.

| | |
| --- | --- |
| Auth | none |
| Request | the dashboard password |
| `200` | `{ "accessToken": "3f8a91e2-7c4d-4b1a-9e05-2d6f8c3a7b19" }` |
| `401` | wrong password |

The token is a random string held in the back end's memory, not a signed token.
One process and one shared password mean statelessness buys nothing, and
restarting the back end simply requires logging in again.

### `GET /api/players`

Who is online, and the server's capacity.

| | |
| --- | --- |
| Auth | none — reading status is not destructive |
| Request | no body |
| `200` | `{ "playerNames": ["Steve"], "maxPlayerCount": 20 }` |
| `503` | `{ "error": "Cannot reach the Minecraft server. It may not be running." }` |

Status and the roster come from one endpoint because a single RCON `list` call
answers both. There is no `isOnline` field: a `200` already means the server
answered, so the field could never be `false`. Player count is likewise absent —
it is the length of `playerNames`, and storing it twice invites the two
disagreeing.

`503` rather than `500`: the back end is healthy, its dependency is not.

### `POST /api/stop`

Stops the Minecraft server.

| | |
| --- | --- |
| Auth | token required |
| Request | no body |
| `202` | `{}` |
| `503` | `{ "error": "Cannot reach the Minecraft server. It may not be running." }` |

`202`, not `200`: RCON replies `Stopping the server` — the process is shutting
down, not already down. `200` would claim the work finished.

The success body is empty. RCON's `Stopping the server` carries no data to
extract, only wording — and it is Minecraft's wording, so echoing it would tie
this API's responses to a sentence we do not control. The status code already
says "accepted, in progress," and there is only one possible outcome, so the
client can supply its own text. `{}` rather than no body at all, so a client
that always parses JSON never hits an empty-response error.

Confirmation lives in the client, not in the request body. Anyone holding a
valid token can therefore stop the server in one call; the token is the real
gate.

### `GET /api/whitelist`

Who is allowed to join.

| | |
| --- | --- |
| Auth | token required |
| Request | no body |
| `200` | `{ "whitelistNames": ["Steve"] }` — `[]` when the list is empty |
| `503` | `{ "error": "Cannot reach the Minecraft server. It may not be running." }` |

Unlike `/api/players`, this one is gated. The criterion is not read-versus-write
but what exposure enables: the online roster is transient and visible to anyone
who joins the game, while the whitelist is the full set of accounts holding
access — a targeting list, and one that stays valid whether or not those players
are online.

An empty whitelist is a `200` with an empty array, not a `404`. The list exists;
it has no entries. The response shape never changes with the contents, so a
client reads one field and renders it, with no branch for the empty case.

RCON says `There are no whitelisted players` when empty and
`There are 1 whitelisted player(s): Steve` otherwise — two different
sentence shapes for one command. Parsing that split is the back end's job; the
client receives an array either way.

### `POST /api/whitelist`

Adds a player to the whitelist.

| | |
| --- | --- |
| Auth | token required |
| Request | `{ "targetMojangName": "Alex" }` |
| `201` | `{ "whitelistNames": ["Steve", "Alex"] }` — the list after the add |
| `409` | `{ "error": "Alex is already whitelisted." }` |
| `404` | `{ "error": "That player does not exist in Mojang account." }` |
| `503` | `{ "error": "Cannot reach the Minecraft server. It may not be running." }` |

The success body is the whole updated list under the same key `GET` uses, not
just the name that was added. The client then has one code path for rendering
the whitelist regardless of which call produced it, and needs no follow-up fetch
to refresh. The cost is two RCON commands per add — `whitelist add`, then
`whitelist list` to read back the result.

Reading the list back also solves casing for free: `alex` goes in, Mojang's
canonical `Alex` comes out, because `whitelist list` reports the canonical form.

`409` and `404` are separate on purpose. Already whitelisted means the request
conflicts with existing state; no Mojang account means the player named does not
exist at all. Both are the caller's problem, but they call for different fixes.

### `DELETE /api/whitelist/<playerName>`

Removes a player from the whitelist. The name travels in the path here rather
than a body, which is what separates this from `POST`.

| | |
| --- | --- |
| Auth | token required |
| Request | no body |
| `200` | `{ "whitelistNames": ["Steve"] }` — the list after the removal |
| `404` | `{ "error": "That player does not exist in Mojang account." }` |
| `503` | `{ "error": "Cannot reach the Minecraft server. It may not be running." }` |

Removing someone who is not on the list is a `200`, not a `404`. The point of
the request is to end with that player absent, and that state already holds, so
`DELETE` stays idempotent. It matters here because the screen removes by row:
the user cannot name someone who is not listed, so the only ways to reach this
case are a double-click or two tabs open — situations where the user already got
what they wanted and an error would only confuse.

The Mojang `404` stays, because that is a different case: not "already gone" but
a name that never identified anyone.

## Design

[`docs/PRD.md`](docs/PRD.md) covers the scope, screens, structure, and the
reasoning behind each technical decision.