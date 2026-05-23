Operator host snapshot (subagent support)
========================================

Purpose
-------
Machine-local facts for the Operator subagent: link speeds, OS uptime, Tailscale CLI
reachability. No MAC addresses. Extended mode redacts likely-public IPv4 as WAN_REDACTED.

Run
---
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/operator/Invoke-OperatorHostSnapshot.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/operator/Invoke-OperatorHostSnapshot.ps1 -Extended

Environment
-----------
  CANONICAL_ROOT   Optional. If the path exists, appends one JSON line per run to
                   CANONICAL\01_OPS\LOGS\operator_host_YYYY-MM-DD.log
  -NoLog           Stdout only (no append).

Defaults (decided for you)
--------------------------
  Tier A always: OS, uptime, up adapters (name, description, link speed, media type),
                 tailscale present + status command success.
  Tier B with -Extended: IPv4 list per interface (WAN redacted), short tailscale status text.
  Logging: on when CANONICAL resolves; off otherwise. Use -NoLog to force stdout-only.
