# CANONICAL naming conventions

Single source of truth for **folders** and **files** under `CANONICAL/`. The naming agent applies these; exceptions need a one-line note in `90_REVIEW/README.txt` or user approval.

## Top-level buckets (do not rename without updating doctrine)

| Code | Role |
|------|------|
| `00_INBOX` | Staging only; nothing permanent |
| `01_OPS` | Playbooks, tasks, logs, automation |
| `02_PROJECTS` | Time-bound outcomes with an end state |
| `03_AREAS` | Ongoing responsibilities (no “done”) |
| `04_ASSETS` | Durable reference: templates, brand, specs |
| `10_DOCS` | Long-form documentation |
| `20_MEDIA` | Images/audio/video not tied to one project |
| `30_CODE` | Repos, scripts, exports of code |
| `35_CAD` | CAD sources and exports |
| `40_ARCHIVE` | Completed or retired material |
| `90_REVIEW` | Unknown / needs decision before filing |
| `99_ARCHIVE` / `99_PROCESSED` | Terminal buckets per your habit |

## Folder names

- Pattern: **`NN_SHORT_LABEL`** at roots you control, or **`UPPER_SNAKE`** / **`ProjectKey_short_topic`** inside projects.
- Use **ASCII letters, digits, underscore** only. No spaces.
- **ProjectKey**: 2–6 uppercase letters or alnum (e.g. `CTS`, `SHOP`, `EVAL24`).
- Keep one obvious topic per folder; split when > ~30 loose files.

## File names

**General (documents, exports, PDFs, zip):**

`ProjectKey_Descriptor_v1.ext`

- **Descriptor**: `Upper_Snake_Case` or `Short-Title-Words` (pick one per project and stay consistent).
- **Version**: `_v1` `_v2` … when you keep multiple revisions; omit if the file is clearly unique or date-stamped.
- **Date-first variant** (good for inbox captures): `YYYY-MM-DD_Descriptor.ext`

**Screenshots / quick captures:**

`YYYY-MM-DD_Descriptor.png`  
If multiple same day: `YYYY-MM-DD_Descriptor_01.png`

**Code / config:**

- Match repo conventions inside `30_CODE`; symlink or shortcut back to CANONICAL only if you document it in `01_OPS`.

**Forbidden in new names**

- Leading/trailing spaces, double spaces, `copy`, `Copy of`, `(1)`, `final`, `FINAL v2`.
- Fix those on sight during naming passes.

## Inbox triage targets

- **Project material** → `02_PROJECTS/<ProjectKey_topic>/` (create folder if missing and name matches convention).
- **Ongoing ops** → `03_AREAS/<area>/`
- **Reusable templates / specs** → `04_ASSETS/`
- **Not sure** → `90_REVIEW/` (never leave in `00_INBOX` overnight if avoidable)
- **Obvious junk** → delete (agent proposes; you confirm)

## MASTER_TASKS

- One line per next action; add a path when it helps: `- [ ] Short action` with suffix `(02_PROJECTS/CTS/…)` or inline `` `path` ``.
