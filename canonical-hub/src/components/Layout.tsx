import { useEffect, useRef, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { SITE } from "../site";

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export function Layout() {
  const [konamiOpen, setKonamiOpen] = useState(false);
  const seqRef = useRef<string[]>([]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const prev = seqRef.current;
      const next = [...prev, key].slice(-KONAMI.length);
      seqRef.current = next;
      if (next.length === KONAMI.length && next.every((k, i) => k === KONAMI[i])) {
        setKonamiOpen(true);
        seqRef.current = [];
        window.setTimeout(() => setKonamiOpen(false), 8000);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="shell">
      <header className="site-header">
        <div className="brand">
          <Link to="/">
            {SITE.name}
            <span className="domain">{SITE.canonicalDomain}</span>
          </Link>
        </div>
        <nav className="main-nav" aria-label="Primary">
          <Link to="/doctrine">Doctrine</Link>
          <Link to="/people">People</Link>
          <Link to="/tools">Tools</Link>
          <Link to="/inbox">Inbox</Link>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <footer className="site-footer">
        <p style={{ margin: "0 0 0.5rem" }}>
          Live app:{" "}
          <a href={SITE.deployedUrl} rel="noopener noreferrer">
            {SITE.deployedUrl.replace(/^https:\/\//, "")}
          </a>
          {" · "}
          Canonical domain: {SITE.canonicalDomain}
        </p>
        <p style={{ margin: 0 }}>
          Static hub — content in <code>src/data/*.json</code>. Deploy <code>dist/</code> to IONOS, Vercel, or
          elsewhere; point <code>{SITE.canonicalDomain}</code> DNS when ready.
        </p>
      </footer>
      {konamiOpen ? (
        <div className="toast-core" role="status">
          Core unlocked. Try the{" "}
          <Link to="/inbox">inbox</Link> route — triage with intent.
        </div>
      ) : null}
    </div>
  );
}
