#!/usr/bin/env bash
#
# install.sh — one-command bring-up for the wpsql CTF box.
#
# Builds the custom target image (WordPress + devops sshd + loopback OliveTin),
# brings up db (MySQL 8) + target, runs the wpcli one-shot provisioner when
# needed, and verifies the known-good end state. Safe to re-run; pass --reset
# for a full clean rebuild.
#
#   ./install.sh            # bring up / converge + verify
#   ./install.sh --reset    # tear down containers AND volumes first, then rebuild
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# --- pretty output ------------------------------------------------------------
info() { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }
ok()   { printf '  [\033[1;32m OK \033[0m] %s\n' "$1"; }
bad()  { printf '  [\033[1;31mFAIL\033[0m] %s\n' "$1"; }
die()  { bad "$1"; exit 1; }

# --- args ---------------------------------------------------------------------
RESET=0
for arg in "$@"; do
  case "$arg" in
    --reset) RESET=1 ;;
    -h|--help)
      sed -n '2,11p' "$0"; exit 0 ;;
    *) die "unknown argument: $arg (try --help)" ;;
  esac
done

# --- prerequisites ------------------------------------------------------------
info "Checking prerequisites"
command -v docker >/dev/null 2>&1 || die "docker not found in PATH (install Docker Engine + the compose plugin)"
docker compose version >/dev/null 2>&1 || die "docker compose plugin not available"
docker info >/dev/null 2>&1       || die "docker daemon not reachable (start dockerd / relogin so your group is picked up)"
ok "docker $(docker --version | awk '{print $3" "$4" "$5}') + compose available"

# --- defensive file perms -----------------------------------------------------
# wpcli runs as uid 33 (www-data) and reads/copies these host files:
#   - setup.sh           is invoked via `sh /setup.sh` -> must be READABLE (not just +x)
#   - oldsite_backup.sql is `cp`'d into the uploads tree -> must be world-readable
info "Ensuring bind-mounted files are readable by wpcli (uid 33)"
chmod 755 setup.sh
chmod 644 oldsite_backup.sql init.sql
ok "permissions set"

# --- optional full reset ------------------------------------------------------
if [ "$RESET" -eq 1 ]; then
  info "RESET: tearing down containers + named volumes (db_data, wp_data)"
  docker compose down -v
  ok "clean slate"
fi

# --- build + up ---------------------------------------------------------------
info "Building custom target image"
docker compose build target
ok "target image built"

info "Bringing up long-running services (db, target)"
# NOTE: wpcli is intentionally NOT started here — it's a one-shot provisioner
# and `docker compose up` would re-run it every time (re-importing products and
# creating duplicates). It is started on-demand below only when provisioning is
# actually needed.
docker compose up -d db target
ok "long-running services started"

# --- wait helpers -------------------------------------------------------------
# NOTE: `--all` is required — `compose ps` only lists RUNNING containers by
# default, so without it a one-shot that has exited (e.g. wpcli) is invisible.
cid_of() { docker compose ps -aq "$1" 2>/dev/null | tail -n1; }

# is WordPress already provisioned? (wp_users table exists with rows)
wp_provisioned() {
  local n
  n="$(docker compose exec -T db mysql -uroot -prootpw wordpress -N -e 'SELECT COUNT(*) FROM wp_users' 2>/dev/null || echo 0)"
  n="${n//[^0-9]/}"; n="${n:-0}"
  [ "$n" -gt 0 ]
}

wait_healthy() {  # $1 = service, $2 = timeout (s)
  local svc="$1" timeout="${2:-120}" i=0 s
  for ((; i<timeout; i+=2)); do
    s="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$(cid_of "$svc")" 2>/dev/null || echo none)"
    [ "$s" = "healthy" ] && return 0
    sleep 2
  done
  return 1
}

wait_exited_ok() {  # $1 = service, $2 = timeout (s)
  local svc="$1" timeout="${2:-360}" i=0 status code
  for ((; i<timeout; i+=3)); do
    status="$(docker inspect --format '{{.State.Status}}' "$(cid_of "$svc")" 2>/dev/null || echo running)"
    if [ "$status" = "exited" ]; then
      code="$(docker inspect --format '{{.State.ExitCode}}' "$(cid_of "$svc")" 2>/dev/null || echo -1)"
      [ "$code" = "0" ] && return 0 || return 1
    fi
    sleep 3
  done
  return 1
}

# --- wait for health + provisioning ------------------------------------------
info "Waiting for db to be healthy"
wait_healthy db 120 || die "db did not become healthy (check: docker compose logs db)"
ok "db healthy"

info "Waiting for target to be healthy"
wait_healthy target 240 || die "target did not become healthy (check: docker compose logs target)"
ok "target healthy"

# --- provision only if needed (idempotent) -----------------------------------
if wp_provisioned; then
  ok "WordPress already provisioned — skipping wpcli (converged)"
else
  info "WordPress not installed yet — running wpcli provisioner"
  info "  (WP install + WooCommerce + demo products + planted backup; ~60-120s)"
  docker compose up -d wpcli
  wait_exited_ok wpcli 420 || {
    bad "wpcli did not finish successfully"
    printf '  last 25 log lines:\n'
    docker compose logs --tail=25 wpcli 2>&1 | sed 's/^/    /'
    die "provisioning failed — run: docker compose logs wpcli"
  }
  ok "provisioning complete (wpcli exited 0)"
fi

# --- verify known-good end state ---------------------------------------------
info "Verifying end state"

# site reachable, and NOT still showing the WP setup wizard
if curl -fsS -o /dev/null http://localhost:8888/; then ok "site responds on :8888"; else die "site not reachable on :8888"; fi
if curl -sI http://localhost:8888/ | grep -qi '^location:.*install\.php'; then
  die "home page still redirects to install.php — WordPress is not installed"
fi
ok "WordPress is installed (no setup wizard)"

# store must be live, not hidden behind WooCommerce 'Coming Soon' mode
CS="$(docker compose exec -T db mysql -uroot -prootpw wordpress -N -e \
  "SELECT option_value FROM wp_options WHERE option_name='woocommerce_coming_soon'" 2>/dev/null || echo '')"
if [ "$CS" = "yes" ]; then
  die "WooCommerce Coming Soon mode is ON — the store is not live to visitors"
fi
ok "store is live (WooCommerce Coming Soon mode off)"

# admin/admin123 actually authenticates
if docker compose run --rm --no-deps -T --entrypoint /usr/local/bin/wp wpcli \
     user check-password admin admin123 --path=/var/www/html >/dev/null 2>&1; then
  ok "admin / admin123 login valid"
else
  die "admin/admin123 login check failed"
fi

# pivot-chain backup planted where the attack expects it (and NOT browseable)
if docker compose exec -T target test -f \
     /var/www/html/wp-content/uploads/2025/migration-backup/oldsite_backup.sql; then
  ok "pivot backup planted (wp-content/uploads/2025/migration-backup/oldsite_backup.sql)"
else
  die "pivot backup not found"
fi
# ...and confirm it's NOT directory-listable (player must find it by shell enum)
if curl -fsS -o /dev/null http://localhost:8888/wp-content/uploads/2025/migration-backup/ 2>/dev/null; then
  die "backup directory is browseable — should be 403 (Options -Indexes)"
fi
ok "backup directory is NOT browseable (must be found via shell enumeration)"

# target supervised services up: apache implied by the healthcheck above; verify
# sshd :22 and loopback-bound OliveTin 127.0.0.1:1337 are listening
if docker compose exec -T target sh -c 'ss -ltn 2>/dev/null | grep -q "127.0.0.1:1337" && ss -ltn | grep -q ":22"'; then
  ok "target: sshd :22 + OliveTin 127.0.0.1:1337 up"
else
  die "target services not listening as expected"
fi

# core security boundary: www-data MUST be blocked from OliveTin on loopback
# (otherwise a www-data webshell curls 1337 and skips straight to root)
if docker compose exec -u www-data -T target sh -c 'curl -sf --max-time 3 http://127.0.0.1:1337 >/dev/null' 2>/dev/null; then
  die "www-data can reach OliveTin on 127.0.0.1:1337 — firewall rule missing/broken"
fi
ok "www-data blocked from OliveTin (127.0.0.1:1337) — SSH-hop-only boundary intact"
# ...while root (and, transitively, a devops SSH local-forward) CAN reach it
if docker compose exec -T target sh -c 'curl -sf --max-time 3 http://127.0.0.1:1337 >/dev/null' 2>/dev/null; then
  ok "root can reach OliveTin locally (devops -L forward path works)"
else
  die "root cannot reach OliveTin locally — OliveTin not serving?"
fi

# --- summary ------------------------------------------------------------------
info "Box is up and provisioned"
cat <<EOF

  Store ......... http://localhost:8888/
  Admin ......... http://localhost:8888/wp-admin/   (admin / admin123)
  SSH ........... devops @ localhost:2222  (pw cracked from leaked backup)
  Services ...... db (mysql:8.0, healthy) · target (healthy)
                   target runs: apache(:80) + sshd(:22) + OliveTin(127.0.0.1:1337)
  wpcli ......... one-shot provisioner, exited 0

  Day-to-day:
    docker compose ps              # status
    docker compose logs wpcli      # provisioning log
    docker compose down            # stop (keep data)
    ./install.sh --reset           # full clean rebuild (wipes db + wp volumes)
EOF
