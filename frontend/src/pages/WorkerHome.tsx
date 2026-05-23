import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BigButton } from "../components/BigButton.js";
import {
  parseActionFromUrl,
  parseWorkerFromUrl,
} from "../lib/workerSession.js";

export function WorkerHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    parseWorkerFromUrl(searchParams.toString());
    const action = parseActionFromUrl(searchParams.toString());
    if (action) {
      navigate(`/worker/form/${action}`, { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="app-shell">
      <h1>FieldPulse</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        Tap what you need to report
      </p>
      <BigButton to="/worker/form/work_done" variant="work">
        I Did Something
      </BigButton>
      <BigButton to="/worker/form/problem_found" variant="problem">
        I Found a Problem
      </BigButton>
      <BigButton to="/worker/form/need_item" variant="need">
        I Need Something
      </BigButton>
    </div>
  );
}
