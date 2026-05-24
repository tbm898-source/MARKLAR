import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { API_BASE_URL } from "../lib/api.js";

interface SetupInfo {
  port: number;
  lanIp: string;
  workerUrl: string;
  adminUrl: string;
  setupUrl: string;
  localWorkerUrl: string;
  emailConfigured: boolean;
  clickupConfigured: boolean;
  phoneInstructions: string[];
}

export function SetupPage() {
  const [info, setInfo] = useState<SetupInfo | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    void fetch(`${API_BASE_URL}/setup`)
      .then((r) => {
        if (!r.ok) throw new Error("Server not ready");
        return r.json() as Promise<SetupInfo>;
      })
      .then((data) => {
        setInfo(data);
        return QRCode.toDataURL(data.workerUrl, { width: 280, margin: 2 });
      })
      .then(setQrUrl)
      .catch(() =>
        setError(
          "Cannot reach the server. Run Start-FieldPulse.bat (or npm run start) first."
        )
      );
  }, []);

  const copy = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  if (error) {
    return (
      <div className="app-shell">
        <h1>FieldPulse Setup</h1>
        <p style={{ color: "var(--danger)" }}>{error}</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="app-shell">
        <h1>FieldPulse Setup</h1>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="app-shell app-shell--admin">
      <h1>FieldPulse — Phone setup</h1>
      <p>Use this page to connect worker phones on the same Wi-Fi.</p>

      <section className="qr-section">
        <h2>1. Scan on your phone</h2>
        <p>Same Wi-Fi as this computer. Open the camera app or browser.</p>
        {qrUrl && (
          <img
            src={qrUrl}
            alt="QR code for worker page"
            className="qr-canvas"
            width={280}
            height={280}
          />
        )}
        <div className="qr-url">{info.workerUrl}</div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ maxWidth: 320 }}
          onClick={() => void copy("worker", info.workerUrl)}
        >
          {copied === "worker" ? "Copied!" : "Copy worker link"}
        </button>
      </section>

      <section className="qr-section">
        <h2>2. Add to Home Screen (optional)</h2>
        <p>
          <strong>iPhone:</strong> Safari → Share → Add to Home Screen
        </p>
        <p>
          <strong>Android:</strong> Chrome → menu (⋮) → Add to Home screen /
          Install app
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
          This installs FieldPulse like an app — no app store needed.
        </p>
      </section>

      <section className="qr-section">
        <h2>3. Quick links (this PC)</h2>
        <p>
          <a href="/worker">Worker page</a> · <a href="/admin">Admin</a>
        </p>
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
          LAN IP: {info.lanIp} · Port: {info.port}
          <br />
          Email: {info.emailConfigured ? "on" : "off"} · ClickUp:{" "}
          {info.clickupConfigured ? "on" : "off (optional)"}
        </p>
      </section>

      <section className="qr-section">
        <h2>Troubleshooting</h2>
        <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
          <li>Phone and PC must be on the same Wi-Fi (not guest network).</li>
          <li>
            If the link does not load, allow Node through Windows Firewall when
            prompted.
          </li>
          <li>
            Try the URL manually: type <code>{info.workerUrl}</code> in the phone
            browser.
          </li>
        </ul>
      </section>
    </div>
  );
}
