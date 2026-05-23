import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  fetchCanonicalStatus,
  fetchConfig,
  fetchIntegrationStatus,
  fetchLogs,
  fetchOperatorHealth,
  fetchSystemSentinel,
  markReviewed,
  retrySync,
  sendEmailReport,
} from "../lib/api.js";
import type {
  CanonicalStatusResponse,
  OperatorHealthResponse,
  SentinelStatusResponse,
  SystemStatusLevel,
} from "../lib/api.js";
import type { AppConfig, FieldLog, SyncStatus } from "../types.js";

const TYPE_LABELS: Record<string, string> = {
  work_done: "Work Done",
  problem_found: "Problem",
  need_item: "Need Item",
};

export function AdminPage() {
  const [logs, setLogs] = useState<FieldLog[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [statusFilter, setStatusFilter] = useState<SyncStatus | "">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [qrWorker, setQrWorker] = useState("Tim");
  const [qrAction, setQrAction] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [integration, setIntegration] = useState<{
    emailConfigured: boolean;
    clickupConfigured: boolean;
  } | null>(null);
  const [emailMsg, setEmailMsg] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [sentinelStatus, setSentinelStatus] =
    useState<SentinelStatusResponse | null>(null);
  const [operatorHealth, setOperatorHealth] =
    useState<OperatorHealthResponse | null>(null);
  const [canonicalStatus, setCanonicalStatus] =
    useState<CanonicalStatusResponse | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLogs({
        status: statusFilter || undefined,
        input_type: typeFilter || undefined,
      });
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);
  const loadSystemData = useCallback(async () => {
    setSystemLoading(true);
    setSystemError("");

    const [sentinelResult, operatorResult, canonicalResult] = await Promise.allSettled([
      fetchSystemSentinel(),
      fetchOperatorHealth(),
      fetchCanonicalStatus(),
    ]);

    if (sentinelResult.status === "fulfilled") {
      setSentinelStatus(sentinelResult.value);
    } else {
      setSentinelStatus({
        ok: false,
        status: "error",
        configured: false,
        exists: false,
        lastModified: null,
        isStale: false,
        staleThresholdHours: 24,
        content: null,
        message:
          sentinelResult.reason instanceof Error
            ? sentinelResult.reason.message
            : "Failed to load sentinel status.",
      });
    }

    if (operatorResult.status === "fulfilled") {
      setOperatorHealth(operatorResult.value);
    } else {
      setOperatorHealth({
        ok: false,
        status: "error",
        configured: false,
        exists: false,
        source: "not_available",
        lastSnapshotTime: null,
        isStale: false,
        warnings: [],
        message:
          operatorResult.reason instanceof Error
            ? operatorResult.reason.message
            : "Failed to load operator health.",
      });
    }

    if (canonicalResult.status === "fulfilled") {
      setCanonicalStatus(canonicalResult.value);
    } else {
      setCanonicalStatus({
        ok: false,
        status: "error",
        configured: false,
        items: [],
        message:
          canonicalResult.reason instanceof Error
            ? canonicalResult.reason.message
            : "Failed to load CANONICAL status.",
      });
    }

    if (
      sentinelResult.status === "rejected" &&
      operatorResult.status === "rejected" &&
      canonicalResult.status === "rejected"
    ) {
      setSystemError("All system status requests failed.");
    }

    setSystemLoading(false);
  }, []);

  useEffect(() => {
    void fetchConfig().then(setConfig);
    void fetchIntegrationStatus().then(setIntegration);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSystemData();
  }, [loadSystemData]);

  const baseUrl = window.location.origin;
  const qrPath = (() => {
    const params = new URLSearchParams();
    if (qrWorker) params.set("worker", qrWorker);
    if (qrAction) params.set("action", qrAction);
    const qs = params.toString();
    return `/worker${qs ? `?${qs}` : ""}`;
  })();
  const qrFullUrl = `${baseUrl}${qrPath}`;

  useEffect(() => {
    void QRCode.toDataURL(qrFullUrl, { width: 256, margin: 2 }).then(
      setQrDataUrl
    );
  }, [qrFullUrl]);
  const formatTimestamp = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const getSystemBadgeStyle = (status?: SystemStatusLevel | "missing") => {
    switch (status) {
      case "ok":
        return {
          background: "#153b2e",
          color: "#8ff0c8",
          border: "1px solid #245a45",
        };
      case "warning":
        return {
          background: "#4a3812",
          color: "#f7d774",
          border: "1px solid #8b6914",
        };
      case "error":
      case "missing":
        return {
          background: "#4f1f1f",
          color: "#ffb3b3",
          border: "1px solid #7a2f2f",
        };
      case "not_configured":
        return {
          background: "#3b334d",
          color: "#d1c4ff",
          border: "1px solid #5f4f87",
        };
      default:
        return {
          background: "#2f3338",
          color: "#d9dde3",
          border: "1px solid #4a525c",
        };
    }
  };

  const renderSystemBadge = (status?: SystemStatusLevel | "missing") => (
    <span
      style={{
        ...getSystemBadgeStyle(status),
        borderRadius: 999,
        display: "inline-block",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.3,
        padding: "4px 10px",
        textTransform: "uppercase",
      }}
    >
      {status ?? "unknown"}
    </span>
  );

  const handleRetry = async (id: string) => {
    await retrySync(id);
    await load();
  };

  const handleReviewed = async (id: string) => {
    await markReviewed(id);
    await load();
  };

  const handleEmailReport = async () => {
    setEmailMsg("");
    setEmailSending(true);
    try {
      const result = await sendEmailReport({
        status: statusFilter || undefined,
        input_type: typeFilter || undefined,
      });
      setEmailMsg(`Report sent (${result.sent} entries).`);
    } catch (err) {
      setEmailMsg(err instanceof Error ? err.message : "Send failed");
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="app-shell app-shell--admin">
      <h1>FieldPulse Admin</h1>
      <p>
        <a href="/worker">Worker page</a> Â· <a href="/setup">Phone setup (QR)</a>
      </p>

      {integration && (
        <div
          className={
            integration.emailConfigured
              ? "integration-banner"
              : "integration-banner integration-banner--warn"
          }
        >
          {integration.emailConfigured
            ? "Email reports are on — new entries email your report address."
            : "Email not set up yet — entries still save locally. Add SMTP settings to .env (see README)."}
          {!integration.clickupConfigured && (
            <span> ClickUp is optional and not configured.</span>
          )}
        </div>
      )}

      <div className="admin-header admin-filters">
        <div>
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SyncStatus | "")}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="synced">Synced</option>
            <option value="failed">Failed</option>
            <option value="reviewed">Reviewed</option>
            <option value="local_only">Saved locally</option>
          </select>
        </div>
        <div>
          <label htmlFor="type">Type</label>
          <select
            id="type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="work_done">Work Done</option>
            <option value="problem_found">Problem</option>
            <option value="need_item">Need Item</option>
          </select>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Refresh
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={emailSending}
          onClick={() => void handleEmailReport()}
        >
          {emailSending ? "Sendingâ€¦" : "Email report"}
        </button>
      </div>
      {emailMsg && <p style={{ marginBottom: "1rem" }}>{emailMsg}</p>}

      {loading ? (
        <p>Loadingâ€¦</p>
      ) : (
        <table className="log-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Worker</th>
              <th>Site</th>
              <th>Type</th>
              <th>Summary</th>
              <th>Status</th>
              <th>ClickUp</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={8}>No records yet</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td>{log.worker_name}</td>
                  <td>{log.site_location}</td>
                  <td>{TYPE_LABELS[log.input_type] ?? log.input_type}</td>
                  <td>{log.summary}</td>
                  <td>
                    <span className={`badge badge-${log.sync_status}`}>
                      {log.sync_status}
                    </span>
                    {log.sync_error && (
                      <div className="error-text">{log.sync_error}</div>
                    )}
                  </td>
                  <td>
                    {log.clickup_task_url ? (
                      <a
                        href={log.clickup_task_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open task
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="admin-actions">
                    {integration?.clickupConfigured &&
                      (log.sync_status === "failed" ||
                        log.sync_status === "pending" ||
                        log.sync_status === "local_only") && (
                        <button
                          type="button"
                          onClick={() => void handleRetry(log.id)}
                        >
                          Retry ClickUp sync
                        </button>
                      )}
                    {log.sync_status !== "reviewed" && (
                      <button
                        type="button"
                        onClick={() => void handleReviewed(log.id)}
                      >
                        Mark reviewed
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      <section className="qr-section">
        <h2>QR link generator</h2>
        <p>Create a QR code for workers to scan and open a prefilled form.</p>
        <div className="admin-filters">
          <div>
            <label htmlFor="qr-worker">Worker</label>
            <select
              id="qr-worker"
              value={qrWorker}
              onChange={(e) => setQrWorker(e.target.value)}
            >
              <option value="">(none)</option>
              {(config?.workers ?? []).map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="qr-action">Action</label>
            <select
              id="qr-action"
              value={qrAction}
              onChange={(e) => setQrAction(e.target.value)}
            >
              <option value="">Home (choose action)</option>
              <option value="work_done">I Did Something</option>
              <option value="problem_found">I Found a Problem</option>
              <option value="need_item">I Need Something</option>
            </select>
          </div>
        </div>
        <div className="qr-url">{qrFullUrl}</div>
        {qrDataUrl && (
          <img src={qrDataUrl} alt="QR code" className="qr-canvas" width={256} height={256} />
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>System / Goliath Console</h2>
            <p style={{ color: "var(--text-muted)", margin: "6px 0 0" }}>
              Read-only control plane status for Sentinel, Operator host health, and
              CANONICAL ops artifacts.
            </p>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => void loadSystemData()}
            disabled={systemLoading}
            type="button"
          >
            {systemLoading ? "Refreshing..." : "Refresh system"}
          </button>
        </div>

        {systemError ? (
          <div
            style={{
              background: "#4f1f1f",
              border: "1px solid #7a2f2f",
              borderRadius: 8,
              color: "#ffcccc",
              marginBottom: 16,
              padding: 12,
            }}
          >
            {systemError}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            marginBottom: 16,
          }}
        >
          <section
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>System Snapshot</h3>
              {renderSystemBadge(sentinelStatus?.status)}
            </div>

            <table style={{ fontSize: 14, width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ color: "var(--text-muted)", padding: "4px 0" }}>Exists</td>
                  <td style={{ padding: "4px 0" }}>{sentinelStatus?.exists ? "Yes" : "No"}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-muted)", padding: "4px 0" }}>Last modified</td>
                  <td style={{ padding: "4px 0" }}>{formatTimestamp(sentinelStatus?.lastModified)}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-muted)", padding: "4px 0" }}>Stale</td>
                  <td style={{ padding: "4px 0" }}>{sentinelStatus?.isStale ? "Yes" : "No"}</td>
                </tr>
              </tbody>
            </table>

            {sentinelStatus?.message ? (
              <p style={{ color: "var(--text-muted)", marginTop: 12 }}>{sentinelStatus.message}</p>
            ) : null}

            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                View snapshot markdown
              </summary>
              <div
                style={{
                  background: "rgba(0,0,0,0.18)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  marginTop: 10,
                  maxHeight: 320,
                  overflow: "auto",
                  padding: 12,
                  whiteSpace: "pre-wrap",
                }}
              >
                {sentinelStatus?.content || "No Sentinel markdown available."}
              </div>
            </details>
          </section>

          <section
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>Operator Host Health</h3>
              {renderSystemBadge(operatorHealth?.status)}
            </div>

            <table style={{ fontSize: 14, width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ color: "var(--text-muted)", padding: "4px 0" }}>Source</td>
                  <td style={{ padding: "4px 0" }}>{operatorHealth?.source ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-muted)", padding: "4px 0" }}>Last snapshot</td>
                  <td style={{ padding: "4px 0" }}>
                    {formatTimestamp(operatorHealth?.lastSnapshotTime)}
                  </td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-muted)", padding: "4px 0" }}>Uptime</td>
                  <td style={{ padding: "4px 0" }}>{operatorHealth?.uptime || "—"}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-muted)", padding: "4px 0" }}>Tailscale</td>
                  <td style={{ padding: "4px 0" }}>
                    {operatorHealth?.tailscaleStatus
                      ? `${operatorHealth.tailscaleStatus.present ? "Present" : "Missing"}${
                          operatorHealth.tailscaleStatus.connected === true
                            ? " / Connected"
                            : operatorHealth.tailscaleStatus.connected === false
                              ? " / Disconnected"
                              : ""
                        }`
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>

            {operatorHealth?.networkAdapters?.length ? (
              <div style={{ marginTop: 12 }}>
                <strong>Active adapters</strong>
                <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                  {operatorHealth.networkAdapters.map((adapter, index) => (
                    <li key={`${adapter.name}-${index}`} style={{ marginBottom: 6 }}>
                      <span>{adapter.name}</span>
                      {adapter.status ? <span> — {adapter.status}</span> : null}
                      {adapter.linkSpeed ? <span> — {adapter.linkSpeed}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {operatorHealth?.warnings?.length ? (
              <div style={{ marginTop: 12 }}>
                <strong>Warnings</strong>
                <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                  {operatorHealth.warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {operatorHealth?.message ? (
              <p style={{ color: "var(--text-muted)", marginTop: 12 }}>{operatorHealth.message}</p>
            ) : null}

            {operatorHealth?.rawSummary ? (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                  View raw cached output preview
                </summary>
                <div
                  style={{
                    background: "rgba(0,0,0,0.18)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    marginTop: 10,
                    maxHeight: 240,
                    overflow: "auto",
                    padding: 12,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {operatorHealth.rawSummary}
                </div>
              </details>
            ) : null}
          </section>
        </div>

        <section
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>CANONICAL Ops</h3>
            {renderSystemBadge(canonicalStatus?.status)}
          </div>

          {canonicalStatus?.message ? (
            <p style={{ color: "var(--text-muted)", marginBottom: 12 }}>
              {canonicalStatus.message}
            </p>
          ) : null}

          <div style={{ overflowX: "auto" }}>
            <table className="log-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Last modified</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {(canonicalStatus?.items || []).map((item) => (
                  <tr key={item.key}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.label}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        {item.relativePath}
                      </div>
                    </td>
                    <td>{renderSystemBadge(item.status)}</td>
                    <td>{formatTimestamp(item.lastModified)}</td>
                    <td>
                      {item.isDirectory ? (
                        <span>{item.itemCount ?? 0} item(s)</span>
                      ) : item.preview ? (
                        <details>
                          <summary style={{ cursor: "pointer" }}>Preview</summary>
                          <div
                            style={{
                              marginTop: 8,
                              maxWidth: 420,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {item.preview}
                          </div>
                        </details>
                      ) : (
                        item.message || "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>    </div>
  );
}
