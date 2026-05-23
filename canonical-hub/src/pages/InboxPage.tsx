import { Link } from "react-router-dom";

export function InboxPage() {
  return (
    <>
      <h1 className="page-title">Inbox</h1>
      <p className="lead">
        Everything lands here first. The joke is that if you never triage, you just have a second
        desktop — the cure is a spine: <Link to="/doctrine">doctrine</Link> and a habit.
      </p>
      <p style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
        Local automation for manifests and sweeps can live under{" "}
        <code>scripts/architect-operator/</code> in the OperatorOS / CANONICAL workspace — wire
        those docs here when you publish them.
      </p>
      <div className="cta-row">
        <Link className="btn primary" to="/doctrine">
          See where things go
        </Link>
        <Link className="btn" to="/">
          Home
        </Link>
      </div>
    </>
  );
}
