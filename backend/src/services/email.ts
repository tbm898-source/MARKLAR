import nodemailer from "nodemailer";
import type { FieldLog } from "../types.js";

export function isEmailConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const to = process.env.REPORT_EMAIL_TO?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  return Boolean(
    host &&
      host !== "smtp.example.com" &&
      to &&
      to !== "you@example.com,manager@example.com" &&
      user !== "your.email@gmail.com" &&
      pass !== "your_app_password_here"
  );
}

function getTransporter() {
  const host = process.env.SMTP_HOST!.trim();
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const secure = process.env.SMTP_SECURE === "true";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

function formatType(type: string): string {
  switch (type) {
    case "work_done":
      return "Work Done";
    case "problem_found":
      return "Problem Found";
    case "need_item":
      return "Need Item";
    default:
      return type;
  }
}

function logToHtml(log: FieldLog): string {
  return `
    <h2>${formatType(log.input_type)} — ${log.worker_name}</h2>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Site</td><td>${escapeHtml(log.site_location)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Summary</td><td>${escapeHtml(log.summary)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Details</td><td>${escapeHtml(log.details || "(none)")}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Safety</td><td>${log.safety_related ? "Yes" : "No"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Follow-up</td><td>${log.follow_up_needed ? "Yes" : "No"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Urgency</td><td>${log.urgency ?? "—"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Submitted</td><td>${log.created_at}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Record ID</td><td>${log.id}</td></tr>
    </table>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function subjectForLog(log: FieldLog): string {
  const date = log.created_at.slice(0, 10);
  switch (log.input_type) {
    case "work_done":
      return `[FieldPulse] Work Done — ${log.worker_name} — ${date}`;
    case "problem_found":
      return `[FieldPulse] Problem — ${log.site_location}${log.safety_related ? " (SAFETY)" : ""}`;
    case "need_item":
      return `[FieldPulse] Need — ${log.summary}`;
    default:
      return `[FieldPulse] New field entry`;
  }
}

export async function sendLogEmail(log: FieldLog): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(
      `[FieldPulse] New entry (email not configured): ${formatType(log.input_type)} — ${log.worker_name} — ${log.summary}`
    );
    return;
  }

  const to = process.env.REPORT_EMAIL_TO!.trim()
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const from =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "fieldpulse@localhost";

  await getTransporter().sendMail({
    from,
    to,
    subject: subjectForLog(log),
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <p style="color:#1a5f2a;font-weight:bold;font-size:16px;">FieldPulse Lite — New Entry</p>
        ${logToHtml(log)}
        <p style="color:#666;font-size:12px;margin-top:24px;">Sent from FieldPulse Lite. View all entries in Admin.</p>
      </div>
    `,
    text: [
      `FieldPulse Lite — ${formatType(log.input_type)}`,
      `Worker: ${log.worker_name}`,
      `Site: ${log.site_location}`,
      `Summary: ${log.summary}`,
      `Details: ${log.details || "(none)"}`,
      `Safety: ${log.safety_related ? "Yes" : "No"}`,
      `Submitted: ${log.created_at}`,
    ].join("\n"),
  });
}

export async function sendReportEmail(logs: FieldLog[]): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email not configured. Set SMTP_HOST and REPORT_EMAIL_TO in .env"
    );
  }

  const to = process.env.REPORT_EMAIL_TO!.trim()
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const from =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "fieldpulse@localhost";

  const rows =
    logs.length === 0
      ? "<p>No entries in this report.</p>"
      : logs
          .map(
            (log) => `
        <tr>
          <td style="padding:6px;border-bottom:1px solid #ddd;">${log.created_at.slice(0, 16).replace("T", " ")}</td>
          <td style="padding:6px;border-bottom:1px solid #ddd;">${escapeHtml(log.worker_name)}</td>
          <td style="padding:6px;border-bottom:1px solid #ddd;">${formatType(log.input_type)}</td>
          <td style="padding:6px;border-bottom:1px solid #ddd;">${escapeHtml(log.site_location)}</td>
          <td style="padding:6px;border-bottom:1px solid #ddd;">${escapeHtml(log.summary)}</td>
          <td style="padding:6px;border-bottom:1px solid #ddd;">${log.sync_status}</td>
        </tr>`
          )
          .join("");

  await getTransporter().sendMail({
    from,
    to,
    subject: `[FieldPulse] Report — ${logs.length} entries — ${new Date().toISOString().slice(0, 10)}`,
    html: `
      <div style="font-family:sans-serif;">
        <h1 style="color:#1a5f2a;">FieldPulse Lite Report</h1>
        <p>${logs.length} entries</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px;">
          <thead>
            <tr style="background:#eeece4;">
              <th style="padding:6px;text-align:left;">When</th>
              <th style="padding:6px;text-align:left;">Worker</th>
              <th style="padding:6px;text-align:left;">Type</th>
              <th style="padding:6px;text-align:left;">Site</th>
              <th style="padding:6px;text-align:left;">Summary</th>
              <th style="padding:6px;text-align:left;">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  });
}
