# Goliath Control Plane / System Dashboard

## Overview

FieldPulse Lite / OperatorOS Tracker remains the existing base application.

The Goliath Control Plane / System Dashboard is a read-only admin extension that adds system visibility without rewriting the app, replacing SQLite, or changing worker flow.

## Component Roles

### FieldPulse
The local-first worker/admin logging application.
- Worker UI at `/worker`
- Admin UI at `/admin`
- SQLite-backed field logs
- Optional email reports
- Optional ClickUp sync

### Operator
Host-level snapshot/reporting logic for the operator machine.
Its cached outputs are used to surface host health in the admin dashboard.

### Architect-Operator
Higher-level operational routines and reminders.
These routines produce artifacts such as daily run outputs and nudge summaries.

### Sentinel
Visibility/snapshot tooling for system awareness.
Its markdown snapshot is surfaced in the admin dashboard.

### CANONICAL
The operator data store for reminders, logs, snapshots, and other operational outputs.

## Dashboard Data Sources

### System Snapshot Card
Reads:
- `CANONICAL/01_OPS/REMINDERS/SENTINEL_LAST.md`

### Operator Host Health Card
Reads:
- latest approved cached operator host snapshot/log output when available

V1 policy:
- cache/file-read only
- no live PowerShell execution
- no backend script spawning
- no frontend-triggered execution
- if no approved cached file exists, return a graceful warning / `not_available` state

### CANONICAL Ops Card
Reads:
- `CANONICAL/01_OPS/REMINDERS/LAST_DAILY_RUN.md`
- `CANONICAL/01_OPS/REMINDERS/NUDGE_GLANCE.md`
- `CANONICAL/01_OPS/REMINDERS/SENTINEL_LAST.md`
- `CANONICAL/01_OPS/LOGS/`

## API Endpoints

- `GET /api/system/sentinel`
- `GET /api/system/operator-health`
- `GET /api/system/canonical-status`

## Configuration

The backend resolves `CANONICAL_ROOT` in this order:
1. `CANONICAL_ROOT`
2. `%USERPROFILE%/Dropbox/CANONICAL`
3. `not_configured`

## Security Boundaries

- Read-only in V1
- V1 operator health is cache/file-read only
- No arbitrary shell execution
- No PowerShell is executed live
- No backend child process/script spawning for V1 operator health
- No frontend-triggered execution
- No user-supplied paths
- Backend-controlled file resolution only
- No secrets returned to the frontend
- No `.env` or local secrets committed
- Existing worker/admin log flow remains intact
- SQLite remains unchanged
