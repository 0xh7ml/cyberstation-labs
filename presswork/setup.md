# wpsql — WordPress → SSH → OliveTin CTF box

A self-hosted CTF lab. A WooCommerce store fronted by WordPress (with MySQL
8.0) and a Linux user `devops` (SSH) plus a loopback-only **OliveTin** service
all live in **one** container (`target`). The intended root path runs the full
chain on a single OS — no Docker-network pivot.

## Topology (single-OS model)

```
player --8888/tcp--> target :80  (WordPress, vulnerable plugin upload -> www-data)
player --2222/tcp--> target :22  (sshd, devops login — post-crack)

inside `target` (one container, one OS, supervisord-managed):
  apache   :80            (WordPress; workers run as www-data)
  sshd     :22            (devops login, password auth)
  OliveTin 127.0.0.1:1337 (loopback ONLY; never published; www-data firewalled out)

db (mysql:8.0) is a SEPARATE compose service on an internal-only network; the
WordPress side of `target` talks to it over `backend`. No other network
segmentation is part of this path.
```

Only two host ports are ever published: **8888** (WordPress) and **2222**
(sshd). **1337 is never published** and is additionally firewalled off from
`www-data` (see "Design decisions" below).

## Requirements

- Docker Engine + the `docker compose` plugin
- Your user able to talk to the daemon (`docker info` works)
- Outbound internet on first run (pulling `wordpress:7.0.0`, `wordpress:cli`,
  `mysql:8.0`, WooCommerce/Storefront from wordpress.org; building `target`
  downloads OliveTin from GitHub)
- Ports `8888` and `2222` free on the host

## Quick start

```bash
./install.sh             # build + bring up + provision + verify
./install.sh --reset     # wipe db & wp volumes first, then a full clean rebuild
./install.sh --help
```

`install.sh` is idempotent: re-running it on an already-provisioned box just
ensures the long-running services are up and **skips the wpcli provisioner**,
so it won't duplicate the demo products.

## Manual alternative

```bash
docker compose up -d db target            # long-running services
docker compose up -d wpcli                # one-shot provisioner (run once)
docker compose logs -f wpcli              # watch provisioning
docker compose down                       # stop, keep data
docker compose down -v                    # stop + wipe db_data & wp_data
```

## Access

| Thing | Value |
|---|---|
| Store | http://localhost:8888/ |
| Admin | http://localhost:8888/wp-admin/ |
| Admin user / pass | `admin` / `admin123` |
| Storefront theme | active |
| Plugins active | WooCommerce, WordPress Importer |
| Demo products | WooCommerce sample catalog imported |
| SSH | `devops @ localhost -p 2222` (password recovered from the leaked backup) |

## Design decisions (resolved against the build spec)

These three were left open / contradictory in `CLAUDE.md`; they are settled
here so the chain is solvable and the boundary holds.

1. **OliveTin is pinned to `3000.10.0`.** This is the last version affected by
   **GHSA-49gm-hh7w-wfvf / CVE-2026-27626** — OS command injection via a
   `password`-typed argument interpolated unsanitized into a `shell:` action.
   `3000.11.0+` refuse to run password-typed args under `shell:`, which would
   break the intended root primitive. **Do not bump OliveTin without
   re-validating the chain.** (See `target/Dockerfile`.)
2. **OliveTin runs as root** (supervisord, no `user=` override). The documented
   root path requires it: the Backup-Database command injection must execute as
   root, and `devops` has no other path to root (no sudo, no SUID shortcut).
3. **`www-data` is firewalled off from OliveTin.** In the merged image,
   `www-data` shares loopback with OliveTin, so without a rule a `www-data`
   webshell could `curl http://127.0.0.1:1337` and skip straight to root.
   `target/init-firewall.sh` installs an iptables owner-match rule that drops
   uid 33 (www-data) going to `127.0.0.1:1337` (`cap_add: NET_ADMIN` in compose
   enables it). Root and `devops` (and thus an `ssh -L` forward) still reach
   it. This keeps the SSH-hop the only way in, per the core security boundary.

## Known-good end state (what `install.sh` verifies)

1. `db` and `target` report `healthy`
2. Only ports `8888` and `2222` are published (`docker compose ps`)
3. `http://localhost:8888/` returns 200 and does **not** redirect to
   `install.php` (WordPress installed, no setup wizard)
4. The store is **live** — `woocommerce_coming_soon` is `no`
5. `admin` / `admin123` authenticates
6. Pivot backup present at
   `wp-content/uploads/2025/migration-backup/oldsite_backup.sql` and the
   directory is **not** browseable (must be found via shell enumeration)
7. `target` has `sshd :22` and `OliveTin 127.0.0.1:1337` listening
8. `www-data` is **blocked** from `127.0.0.1:1337`; root can reach it locally
9. `wpcli` exited 0

## Intended attack chain

1. **Foothold on WordPress** — admin uploads a malicious plugin zip
   (`/wp-admin/plugin-install.php`) → PHP executes as `www-data` (uid 33).
2. **Enumerate from the www-data shell** — `getent passwd devops` shows the
   `devops` user; `find / -name '*.sql'` locates the leaked
   `wp-content/uploads/2025/migration-backup/oldsite_backup.sql`. It is
   world-readable but **not** directory-listable.
3. **Crack the devops credential** — `legacy_users` stores **raw MD5** hashes
   (`hashcat -m 0`, rockyou). The `devops` row notes it "reuses same pw on
   ssh". `d5c0607301ad5d5c1528962a83992ac8` → `sunshine1`.
4. **SSH as devops** — `ssh devops@<host> -p 2222` (password `sunshine1`).
   `~/user.txt` is the **first flag**. (www-data cannot reach OliveTin and
   devops cannot write `/var/www/html`, so this hop is forced.)
5. **Reach OliveTin via a local forward** — it's bound to `127.0.0.1:1337`
   inside `target`, so from the devops session:
   `ssh -L 1337:127.0.0.1:1337 devops@<host> -p 2222`, then on the player's
   machine `curl http://127.0.0.1:1337/`.
6. **Root via command injection** — trigger the "Backup Database" action over
   the forwarded port. `db_pass` is `type: password` and is interpolated
   unsanitized into the action's `shell:` (CVE-2026-27626). Inject to run a
   command as **root** (OliveTin's process uid) and read `/root/root.txt` —
   the **root flag**.

## Notes / gotchas

- **OliveTin version** — see design decision #1. The build prints the version
  on start (`version="3000.10.0"`); if you ever see `3000.11.0+`, the root
  step will fail with "unsafe argument type 'password' cannot be used with
  Shell execution."
- **wp-cli ↔ MySQL 8.0**: the bundled MariaDB client in `wordpress:cli`
  rejects MySQL 8.0's self-signed TLS cert and wp-cli hard-codes
  `--no-defaults`. Handled by: `db` runs with
  `--default-authentication-plugin=mysql_native_password`, and `setup.sh`
  waits on a raw `php -r` mysqli probe instead of `wp db check`. Don't
  "simplify" the wait loop back to `wp db check`.
- **wordpress:7.0.0 is Debian trixie**, where `mysql-client` was dropped;
  `target` installs `mariadb-client` (provides `mysqldump`) so the Backup
  Database action looks realistic. The injection primitive does not depend on
  `mysqldump` being present.
- **CMD shim**: `target` keeps `CMD ["apache2-foreground"]` (inherited) so the
  base image's `docker-entrypoint.sh` runs its WordPress setup (file copy +
  `wp-config.php`) — that setup only fires when `$1` starts with `apache2`.
  The `apache2-foreground` binary is replaced with a shim that hands off to
  supervisord, which then runs the real apache (`apache2-foreground.real`)
  plus sshd and OliveTin.
- **File perms**: `setup.sh` and `oldsite_backup.sql` must be world-readable
  because `wpcli` runs as uid 33 (`www-data`). `install.sh` enforces this.
- **`devops` has no sudo** (sudo isn't even installed), only standard OS SUID
  binaries, and no writable root-owned files — OliveTin is the sole root path.
