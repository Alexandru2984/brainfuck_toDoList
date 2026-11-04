# Operations

## Deployment boundaries

Only this application's service, environment settings and Nginx vhost are in
scope. Do not reload unrelated application services. The live Nginx vhost is
`/etc/nginx/sites-available/brainfuck.micutu.com-canary`; the systemd unit is
`/etc/systemd/system/brainfuck-canary.service`. Existing origin guards and TLS
certificate renewal remain required. The global Cloudflare IP list is managed
separately; the app trusts one Nginx-normalized X-Forwarded-For hop.

## Backup and restore

Use SQLite's backup API, not a plain copy of an open WAL database. Store backups
with mode 600 outside the web root and include the versioned code revision and
encryption key inventory in the operator's secure backup system. Never add keys
or database files to Git. The review snapshots are local recovery aids, not an
automated off-host backup system.

Test restore in a temporary database with the same encryption keys and the
matching code. Verify `PRAGMA integrity_check`, successful authenticated
migration, task counts and exports in the isolated instance. Do not remove an
old encryption key just because a new key has been configured: valid existing
rows are not automatically rotated. A lost key cannot be recovered by changing
the session secret.

Schema additions are backward-readable, but new `bf1:` ciphertext and sessions
require this release. **Do not roll code back across the storage migration alone.**
Restore the matching pre-migration database with the prior code and prior
cryptography version. Before any restore, preserve a fresh snapshot of current
state; replay newer user changes deliberately to avoid data loss.

## Detection and incident response

HTML uses `Cache-Control: no-store, no-transform`, which prevents Cloudflare
Web Analytics and JavaScript Detections from injecting code into documents.
This preserves the editor's strict CSP and avoids third-party scripts accessing
code/input fields. Zone WAF rules were not changed. Robots and sitemap are
served without no-transform, preserving the existing managed crawler policy.
Nginx hides upstream copies of the security headers and emits a single policy;
the app still protects direct loopback responses.

Provider references: [Cloudflare Web Analytics injection](https://developers.cloudflare.com/web-analytics/faq/)
and [JavaScript Detections](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/).

- Probe `https://brainfuck.micutu.com/healthz` externally. Alert after two
  consecutive failures, and on certificate expiry. An alert destination and
  on-call owner must be configured by the operator.
- Count `failed_login` and `login_locked` events by normalized client IP over a
  five-minute window; investigate sustained lockouts and distributed attempts.
- Alert immediately on `storage_integrity_error`, repeated service restarts, or
  sustained 5xx in the dedicated Nginx access/error logs and systemd journal.
- Log retention, access control and off-host delivery must be configured at host
  level. Do not include task content, passwords, cookies or form bodies in logs.

On suspected unauthorized access: restrict this vhost, preserve logs and a
consistent DB snapshot, rotate the password and session secret, and restart the
app. Password rotation invalidates prior authentication versions. Keep the
storage key until an authenticated, tested rotation is complete. Assess actual
exposed data before deciding on notifications; this repo does not establish a
regulatory notification process.

On failed integrity validation: stop writes, restore the correct key set, verify
a copy, then restart this service. Never replace authentication failures with
plaintext fallback. The local regressions exercise wrong keys without writes
and cookie replay after logout; production alert delivery has not been tested.

## Verification commands

```sh
sudo nginx -t
sudo systemctl status brainfuck-canary --no-pager
curl --fail https://brainfuck.micutu.com/healthz
curl --head https://brainfuck.micutu.com/lab
curl --head https://brainfuck.micutu.com/tasks
```

A healthy `/healthz` is 200; anonymous `/tasks` redirects to login. `/lab` is
public and `/tasks`, login and exports send noindex and no-store headers.
Browser code runs locally and makes no execution requests to the VPS.
