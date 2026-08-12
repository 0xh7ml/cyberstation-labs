# syntax=docker/dockerfile:1
#
# target/ — the SINGLE-OS image for the wpsql CTF box.
#
# Merges what used to be two separate containers (wordpress foothold + opsbox
# devops/OliveTin pivot) into one Debian image based on the official wordpress
# image. Three long-running processes live here under supervisord:
#
#   - apache (WordPress, served on :80, published as host :8888)   -> www-data workers
#   - sshd   (devops login, :22, published as host :2222)
#   - OliveTin (127.0.0.1:1337 ONLY — never published, loopback-bound)
#
# Attack chain this image realises (see ../CLAUDE.md):
#   WP RCE -> www-data -> find leaked backup -> crack devops hash ->
#   ssh devops@:2222 (user.txt) -> ssh -L 1337 forward ->
#   OliveTin command-injection (runs as root) -> /root/root.txt
#
# Design decisions (resolved against contradictions in CLAUDE.md):
#   * OliveTin runs as ROOT (supervisord, no user= override). The documented
#     root path requires it; "devops has no privesc shortcuts" means there is
#     no other way to reach root. The task-#1 "user=devops" note is superseded.
#   * www-data (uid 33) is BLOCKED from 127.0.0.1:1337 by an iptables owner
#     rule (init-firewall.sh). In the merged image www-data shares loopback
#     with OliveTin, so without this a www-data webshell could curl OliveTin
#     and skip straight to root. The rule preserves the SSH-hop-only boundary.
#   * Only ports 80 and 22 are published (via compose); 1337 never is.

FROM wordpress:7.0.0

# Pinned to 3000.10.0 deliberately: this is the last version affected by
# GHSA-49gm-hh7w-wfvf / CVE-2026-27626 (OS command injection via a `password`-
# typed argument interpolated unsanitized into a `shell:` action). 3000.11.0+
# refuse to run password-typed args under shell: ("unsafe argument type
# 'password' cannot be used with Shell execution"), which would break the
# intended root primitive. Do NOT bump this without re-validating the chain.
ARG OLIVETIN_VERSION=3000.10.0
ARG OLIVETIN_ARCH=linux-amd64

# --- toolchain: sshd + supervisor + firewall + verification helpers ----------
# NOTE: wordpress:7.0.0 is Debian trixie, where mysql-client was dropped; use
# mariadb-client (provides mysqldump) so the OliveTin "Backup Database" action
# looks realistic. The injection primitive does NOT depend on mysqldump.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        openssh-server \
        supervisor \
        iproute2 \
        iptables \
        mariadb-client \
        procps \
        less \
    && rm -rf /var/lib/apt/lists/*

# --- devops user: password hash is sha512crypt for "sunshine1" ----------------
# This MUST stay byte-identical to the devops row leaked in oldsite_backup.sql
# (raw MD5 d5c0607301ad5d5c1528962a83992ac8 = md5("sunshine1")). The player
# cracks the MD5 -> "sunshine1" -> reuses it here over SSH.
RUN useradd -m -s /bin/bash devops && \
    usermod --password '$6$.mfSJFFsjrAqQ294$E.40hkz4NG2.J6pVtBmFBy4Ru.6J9WeEx5TsrOYpnDHJlD.yV8MwHXoa5wNVqnkE7wtF2GzP9Yn0zNHIcq2Cc1' devops

# --- sshd: host keys, runtime dir, devops password auth, no root login --------
RUN ssh-keygen -A && \
    mkdir -p /run/sshd && \
    printf 'PasswordAuthentication yes\nPermitRootLogin no\nUsePAM yes\n' \
        > /etc/ssh/sshd_config.d/99-ctf.conf

# --- OliveTin, loopback-bound in olivetin/config.yaml -------------------------
# config.yaml sets `listenAddressSingleHTTPFrontend: "127.0.0.1:1337"`, so the
# listener is on loopback only — plus the iptables rule below additionally
# blocks www-data from even that. Never publish 1337 in compose.
RUN curl -fsSL -o /tmp/olivetin.tar.gz \
        "https://github.com/OliveTin/OliveTin/releases/download/${OLIVETIN_VERSION}/OliveTin-${OLIVETIN_ARCH}.tar.gz" && \
    mkdir -p /tmp/olivetin-extract && \
    tar -xzf /tmp/olivetin.tar.gz --strip-components=1 -C /tmp/olivetin-extract && \
    mv /tmp/olivetin-extract/OliveTin /usr/local/bin/OliveTin && \
    mv /tmp/olivetin-extract/webui /usr/local/bin/webui && \
    chmod +x /usr/local/bin/OliveTin && \
    rm -rf /tmp/olivetin.tar.gz /tmp/olivetin-extract && \
    mkdir -p /config/entities /opt/backups

COPY olivetin/config.yaml  /config/config.yaml
COPY olivetin/entities/    /config/entities/

# --- supervisord: apache + sshd + olivetin (olivetin as ROOT) + firewall ------
# OliveTin's "Backup Database" action interpolates db_pass (type: password)
# unsanitized into its shell:; since OliveTin here runs as root, injection
# there is a root shell — that is the one intended root path.
COPY supervisord.conf   /etc/supervisor/conf.d/supervisord.conf
COPY init-firewall.sh   /usr/local/bin/init-firewall.sh
RUN chmod +x /usr/local/bin/init-firewall.sh && mkdir -p /var/log/supervisor

# Shim: keep CMD=apache2-foreground (the value that triggers the base image's
# docker-entrypoint.sh WordPress setup) but replace the binary the entrypoint
# finally execs with a hand-off to supervisord. supervisord then starts the REAL
# apache via apache2-foreground.real, plus sshd and OliveTin. See
# apache2-foreground and supervisord.conf.
RUN mv /usr/local/bin/apache2-foreground /usr/local/bin/apache2-foreground.real
COPY apache2-foreground /usr/local/bin/apache2-foreground
RUN chmod +x /usr/local/bin/apache2-foreground

# --- placeholder flags (swapped for real values only at final packaging) ------
RUN printf 'HTB{fake_user_flag_replace_me}\n' > /home/devops/user.txt && \
    chown devops:devops /home/devops/user.txt && chmod 600 /home/devops/user.txt && \
    printf 'HTB{fake_root_flag_replace_me}\n' > /root/root.txt && \
    chmod 600 /root/root.txt

EXPOSE 80 22
# NOTE: 1337 is intentionally NOT exposed/published. OliveTin listens only on
# 127.0.0.1 inside this container and (via init-firewall.sh) only root/non-
# www-data locals can reach it — forcing the devops SSH local-forward step.

# Inherit ENTRYPOINT (docker-entrypoint.sh) from the base image, and keep its
# default CMD (apache2-foreground). docker-entrypoint.sh only performs WordPress
# setup (copying core files + writing wp-config.php) when $1 starts with
# "apache2", so we keep that CMD; the apache2-foreground binary it execs is the
# shim above, which hands off to supervisord. Net: entrypoint sets up WP, then
# supervisord runs apache + sshd + OliveTin.
CMD ["apache2-foreground"]
