import { Link } from "react-router-dom";
import releases from "../data/releases.json";
import type { ToolRelease } from "../types/content";

type ReleasesFile = {
  operatorosTracker: ToolRelease;
};

const data = releases as ReleasesFile;
const tool = data.operatorosTracker;

export function ToolsPage() {
  return (
    <>
      <h1 className="page-title">Tools &amp; releases</h1>
      <p className="lead">Shipped artifacts with a version and a story. Home base for downloads and notes.</p>

      <section className="section" aria-labelledby="tracker-heading">
        <h2 id="tracker-heading">{tool.name}</h2>
        <div className="card" style={{ maxWidth: "36rem" }}>
          <span className="pill">v{tool.currentVersion}</span>
          <p style={{ marginTop: "0.75rem", color: "var(--muted)" }}>{tool.summary}</p>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            Source layout in repo: <code>{tool.repoPath}</code>
          </p>
          {tool.downloadUrl ? (
            <p className="cta-row" style={{ marginBottom: 0 }}>
              <a className="btn primary" href={tool.downloadUrl} rel="noopener noreferrer">
                Download latest
              </a>
            </p>
          ) : (
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: "1rem" }}>
              {tool.downloadNote}
            </p>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="changelog-heading">
        <h2 id="changelog-heading">Changelog</h2>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--muted)" }}>
          {tool.changelog.map((entry) => (
            <li key={entry.version} style={{ marginBottom: "1rem" }}>
              <strong style={{ color: "var(--text)" }}>
                {entry.version}
              </strong>{" "}
              <span style={{ fontSize: "0.85rem" }}>({entry.date})</span>
              <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.25rem" }}>
                {entry.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <p style={{ marginTop: "2rem", fontSize: "0.875rem" }}>
        <Link to="/">← Back home</Link>
      </p>
    </>
  );
}
