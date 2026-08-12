#!/bin/sh
#
# init-firewall.sh — enforce the OliveTin reachability boundary.
#
# In this merged single-OS image, www-data shares loopback with OliveTin
# (127.0.0.1:1337). Without this rule a www-data webshell (from the WordPress
# RCE) could `curl http://127.0.0.1:1337` and trigger the root injection
# directly, skipping the entire crack -> SSH -> local-forward chain.
#
# Rule: drop any packet leaving a socket owned by www-data (uid 33) bound for
# 127.0.0.1:1337. devops (and root, and sshd's forwarded connection) are NOT
# www-data, so the intended `ssh -L 1337:127.0.0.1:1337 devops@target` path
# still works. Requires CAP_NET_ADMIN (granted in docker-compose.yml).
#
# Idempotent: `-C` checks for the rule first so re-runs on restart are safe.
set -eu

RULE="OUTPUT -p tcp -d 127.0.0.1 --dport 1337 -m owner --uid-owner www-data -j DROP"

if iptables -C $RULE 2>/dev/null; then
    echo "[firewall] rule already present (www-data blocked from 127.0.0.1:1337)"
else
    iptables -A $RULE
    echo "[firewall] installed rule: www-data (uid 33) blocked from 127.0.0.1:1337"
fi

# sanity log: confirm it's in the chain
iptables -S OUTPUT | grep '1337' || true
