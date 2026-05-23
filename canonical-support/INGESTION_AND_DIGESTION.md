# Ingestion and digestion — many streams, one guardrail

You do not reliably open daily reminders. That is normal. The system should assume **gaps** and still surface **safe, high-signal** context from the environment — then **digest** only what passes guardrails into action.

---

## 1. Streams (inputs) — use many small tributaries

| Stream | What it carries | Stale-tolerant? |
|--------|-----------------|-----------------|
| **LAST_DAILY_RUN.md** | Morning status + nudge echo + Cursor steps | Partially — refresh daily, read when you can |
| **SENTINEL_LAST.md** | Git + CANONICAL + tasks + host (one pane) | Yes — run on schedule or demand |
| **NUDGE_GLANCE.md** | One rotating meat-brain line | Yes — pulse optional |
| **triage_manifest_*.md** | Top inbox files for agent filing | Yes — regenerate anytime |
| **architect_operator_*.log** / **sentinel_visibility_*.log** | Append-only machine evidence | Yes |
| **MASTER_TASKS.md** | Human-owned intent (P1/P2/P3) | Source of truth for *what to do* |
| **Git / CI** | Branch, diff, automated checks | Yes — visibility into “did the repo move?” |
| **Host snapshot JSON** | Link + Tailscale CLI sanity | On demand |
| **Paste / voice / screenshot → inbox** | Raw capture | **Never** auto-digests to action |

Anything not listed is **Tier unknown** until classified.

---

## 2. Guardrails — what may be **ingested** vs **digested**

**Ingested** = allowed into logs, manifests, agent context, or `SENTINEL_*` / ambient JSON **without** implying you agreed to act.

**Digested** = becomes a concrete next action (task text, code change, file move, send, spend). **Digestion requires a gate.**

| Tier | Examples | Ingest? | Digest to action? |
|------|-----------|---------|-------------------|
| **T0 — metrics** | File counts, mtimes, task last-result codes, `git status -sb` | Yes | No — informs only |
| **T1 — you wrote it** | `MASTER_TASKS`, `NUDGES_STANDING`, explicit chat “do X” | Yes | Yes for tasks you wrote; chat needs your explicit “apply” for repo changes |
| **T2 — names only** | Recent inbox **paths/filenames** from ambient snapshot | Yes | **Propose only** — moves go through triage agent + your **apply** |
| **T3 — contents** | File bodies, email text, transcripts | Only via **manifest + triage rule** (or you paste intentionally) | **Never** bulk auto-move/delete/send |

**Hard stops (never automatic):** payments, outbound messages, irreversible deletes, anything touching credentials, “fix” remote infra without you saying so.

---

## 3. Digestion pipeline (action)

1. **Collect** — scripts produce T0/T2; you add T1.
2. **Sort** — P0 = sweep failed / CANONICAL missing / huge inbox; P1 = stale sentinel + big drift; P2 = hygiene.
3. **Propose** — inbox triage agent outputs MOVE/RENAME/DELETE with paths; council produces a brief for blurry multi-step work.
4. **Commit** — you merge into `MASTER_TASKS` or say **apply** on triage; Implementer only after Architect + (if needed) Verifier.
5. **Record** — one-line in log or git commit message *why* (Scribe habit).

If you skip step 1 for days, **ambient snapshot** still answers: “what changed on disk and time since last daily?”

---

## 4. Failure mode you named — “I didn’t open the reminder”

Fallback order:

1. **Scheduled** `SENTINEL_LAST.md` + optional pulse `NUDGE_GLANCE.md` (already).
2. **On-demand** `Invoke-SentinelVisibilitySnapshot.ps1` + `Invoke-AmbientSignalsSnapshot.ps1` (names + staleness, no content).
3. When you **do** open Cursor, `@`-mention `SENTINEL_LAST.md` or the latest manifest — agents read evidence, not guilt.
4. **Weekly** reset still pulls you back to three outcomes; if missed, Sentinel staleness flags show “cadence debt” without shaming.

---

## 5. Repo tools (concrete)

| Script | Role |
|--------|------|
| `scripts/sentinel/Invoke-SentinelVisibilitySnapshot.ps1` | T0 pane: git + CANONICAL + tasks + host |
| `scripts/sentinel/Invoke-AmbientSignalsSnapshot.ps1` | T0/T2: staleness + `cadenceDebt` + recent inbox **names** only (no contents) |
| `scripts/architect-operator/Export-InboxTriageManifest.ps1` | T2 → triage agent input |
| `scripts/operator/Invoke-OperatorHostSnapshot.ps1` | T0 host/link |

Council **Sentinel** tier uses these instead of guessing.

---

## 6. What *not* to build (yet)

- Silent ingestion of email, DMs, or mic **without** explicit export into a folder you control.
- Auto-execution from “AI inferred intent” with no human gate on Tier ≥2.

Expand streams only when each new pipe has a **Tier label** and a **digestion gate**.
