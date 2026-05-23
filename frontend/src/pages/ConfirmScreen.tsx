import { BigButton } from "../components/BigButton.js";
import { useLocation } from "react-router-dom";

export function ConfirmScreen() {
  const location = useLocation();
  const queued = Boolean(
    (location.state as { queued?: boolean } | null)?.queued
  );

  return (
    <div className="app-shell">
      <div className="confirm-screen">
        <h1>{queued ? "Saved on this phone." : "Saved. Thank you."}</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
          {queued
            ? "It will send automatically when the server is reachable."
            : "Your entry was recorded."}
        </p>
        <BigButton to="/worker" variant="work">
          Done
        </BigButton>
      </div>
    </div>
  );
}
