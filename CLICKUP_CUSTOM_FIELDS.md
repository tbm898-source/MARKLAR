# ClickUp Custom Fields (Future / Optional)

**Not implemented in the FieldPulse Lite MVP.** Core task sync (name, description, priority) should be stable before adding custom fields.

## When to add

After you consistently see tasks created in the correct list with correct Markdown descriptions and priorities, you can map FieldPulse fields to ClickUp custom fields (e.g. Site, Worker, Safety flag).

## How ClickUp custom fields work

1. In ClickUp, open your target List and note custom field definitions (or use the API).
2. `GET https://api.clickup.com/api/v2/list/{list_id}/field` with header `Authorization: {CLICKUP_API_TOKEN}`.
3. Each field returns an `id` and `type` (short_text, drop_down, checkbox, etc.).

## Example extension in `backend/src/services/clickup.ts`

After creating a task, optionally `POST` field values:

```ts
// Pseudocode — add after task create returns task.id
await fetch(`${baseUrl}/task/${taskId}/field/${fieldId}`, {
  method: "POST",
  headers: { Authorization: token, "Content-Type": "application/json" },
  body: JSON.stringify({ value: siteLocation }),
});
```

Or include `custom_fields` in the initial create-task body if your ClickUp plan supports it on create:

```json
{
  "name": "...",
  "description": "...",
  "custom_fields": [
    { "id": "abc123", "value": "Main Site" }
  ]
}
```

## Suggested mappings (when you implement)

| FieldPulse field   | Suggested ClickUp custom field |
|--------------------|--------------------------------|
| `site_location`    | Site / Location (short text)   |
| `worker_name`      | Worker (short text)            |
| `safety_related`   | Safety (checkbox)              |
| `input_type`       | Entry Type (dropdown)          |

## Testing

1. Create one test task manually with custom fields filled.
2. Enable one field in code, deploy, submit one log, verify in ClickUp.
3. Add remaining fields incrementally.

## Do not require custom fields for workers

Workers never see ClickUp. All custom field population stays server-side in `clickup.ts`.
