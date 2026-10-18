# M8: prepared release path, not provisioned

Use one Linux VPS with Node 24, one Next server process, local durable SSD storage and nginx terminating HTTPS. Compose pins one immutable image, exposes Node only on loopback, and binds SQLite to `/srv/soryn/data`. No serverless filesystem, replicas, rolling overlap, Redis or WebSockets. This is the prepared path, not an approved host purchase.

A practical initial machine has 2 vCPU, 4 GB RAM and at least 40 GB SSD; build elsewhere if memory is tight. Asset traffic and SQLite growth still need measurement. A candidate is Hetzner CX23 in an available EU region. Its [June 2026 price table](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) lists €5.49/month excluding IPv4 and VAT; the [current product page](https://www.hetzner.com/cloud/cost-optimized/) lists the machine specifications. Planning allowance: **€10–20/month plus domain and applicable tax**, including room for off-host backup storage. This is an estimate, not a purchased quote. Availability, currency conversion and current pricing must be checked at approval.

Founder decisions needed: provider/account/region, exact hostname and DNS authority, monthly spending cap, domain budget, off-host encrypted-backup destination and its access/retention owner. No resources, DNS, accounts or paid RPC were created.

## Configuration

Build `ops/Dockerfile` from the project root. Only `NEXT_PUBLIC_PRIVY_APP_ID` and optional `NEXT_PUBLIC_PRIVY_CLIENT_ID` are build arguments; they are public identifiers, baked into client bundles. Set the same application in Privy's allowed origins/redirects and enable identity tokens manually. No provider app secret or wallet signing key is required.

Runtime `/etc/soryn/runtime.env` (root-readable, never source-controlled):

- `APP_ORIGIN=https://<approved exact hostname>` with no path; same origin in browser, proxy and login scope.
- `CHOG_DB_PATH=/data/soryn.sqlite` is supplied by Compose. Never use the saved development database.
- `MONAD_RPC_URL=https://rpc.monad.xyz` or another separately approved, verified read-only endpoint. No paid provider configured.
- `CHOG_PRIVY_SERVER_APP_ID` must equal the built public app ID.
- `PRIVY_VERIFICATION_MODE=jwks` for official rotating public keys. `PRIVY_VERIFICATION_KEY` is used only for deliberately pinned `pem` mode; never install synthetic fixture keys on the host.
- `SORYN_BUILD_ID` from Compose is a public release identifier (1–80 ASCII letters/digits/period/underscore/hyphen).
- **Unset** `CHOG_PVP_TIMERS`, `CHOG_PVP_MOVE_MS`, `CHOG_PVP_PRESENT_MS`, `CHOG_PVP_LOADING_MS`; never deploy the test harness or its environment.

The Docker context excludes environment files, local data, Git, evidence and caches. The app user is UID 1000. Host directories `/srv/soryn/data` and `/srv/soryn/backups` must be owned by that UID and mode 0700 before launch. Do not expose port 3000 remotely. No process manager may add replicas.

Install the reviewed nginx template with the real host/certificate paths and `ops/soryn-proxy.conf` at `/etc/nginx/soryn-proxy.conf`. Test with `nginx -t` before reload. It limits actual socket addresses, overwrites forwarding headers, bounds bodies/connections, and disables access logging. If a CDN is later introduced, first configure its exact trusted IP ranges; do not blindly trust forwarded addresses. Application identity limits and a shared 30/min public-profile budget remain in addition to nginx limits. These are small-playtest bounds, not a scale or DDoS guarantee.

HTTPS causes identity and guest cookies to be `Secure`, HttpOnly and SameSite Strict. Origin checking is exact. Next emits nosniff, frame denial and same-origin referrer policy; nginx adds HSTS. Verify all response headers and cookies on the actual HTTPS host before holder access. `/health` returns only `{ready, build}`, no paths or environment data; unavailable storage returns 503. It checks the SQLite transaction/write-lock boundary, not Monad or Privy reachability.

## Rollout and rollback runbook — commands prepared only

After approval, from the checkout on the build machine:

```sh
docker build -f ops/Dockerfile --build-arg NEXT_PUBLIC_PRIVY_APP_ID --build-arg NEXT_PUBLIC_PRIVY_CLIENT_ID -t soryn:<release-id> .
```

Set `SORYN_IMAGE` and `SORYN_BUILD_ID` in a protected operator shell or an explicit Compose env file. Transfer the image by the approved channel. Never run `git clean`, overwrite environment files, or prune volumes during rollout.

1. Put the site into maintenance at nginx; stop ingress, wait for in-flight requests, then `docker compose -f ops/compose.yml stop app`.
2. With the previous image and server **stopped**, take a verified consistent backup:

```sh
docker compose -f ops/compose.yml run --rm --no-deps app node scripts/release/backup.mjs /data/soryn.sqlite /backups/pre-<release-id>.sqlite
```

3. Switch the immutable image/build tag, then `docker compose -f ops/compose.yml up -d --no-deps app`. Do not run the old binary concurrently. Startup applies additive schema version 3 inside a transaction; failures roll back that migration and stop readiness. A newer unknown schema is refused.
4. `curl --fail --silent https://<approved-host>/health` must show the intended build. Verify HTTPS origin, Secure cookies, proxy 429 behavior, read-only RPC, guest resume and official failure/recovery. Then remove maintenance. Keep the previous image and pre-release backup.
5. On failure: reinstate maintenance and stop the new app. Preserve the failed database and its WAL/SHM together for investigation. Restore the verified pre-release backup **to a new empty data directory**, set UID/mode, point the bind mount at that directory, select the previous image and start once. Do not overlay a main file onto live WAL/SHM, edit `user_version`, or attempt a downgrade migration. Restore loses writes since the backup; explicitly accept that recovery point before reopening ingress.

Back up daily and before every release using the online SQLite backup script; do not copy only the main file of an active WAL database. Use a new filename every time, encrypt off-host copies with operator-controlled keys, and test restoration to a temporary directory. Proposed retention 7 daily + 4 weekly copies, pending founder approval. Backups contain private wallet/session/progress data. Withdrawal changes current public visibility but cannot erase old backups or downloaded copies.

## Actual local verification

`node scripts/release/verify-local.mjs` starts production Next on loopback 3500, with all shortened timers removed and a disposable version-2 fixture database. It migrates to version 3, preserves a private checkpoint and active reservation through a real process restart, checks minimal readiness/build ID, verifies a pre-migration online backup and starts again from that restored backup. Evidence: `docs/evidence/soryn-readiness/local-release.json`. Storage/unit tests also cover migration rollback, unsupported future schemas and backup permissions/integrity.

Docker CLI exists but its daemon is unavailable on this machine; image build, Compose startup and nginx/TLS checks were **not run**. Native Node production tests do not establish container or hosted behavior. No physical two-device/network test, paid-resource provisioning or deployment has occurred. These remain release gates.
