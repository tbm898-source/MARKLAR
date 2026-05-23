import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SelectOrOther } from "../components/SelectOrOther.js";
import { YesNo } from "../components/YesNo.js";
import { fetchConfig, submitLog, uploadPhoto } from "../lib/api.js";
import {
  getStoredWorker,
  parseWorkerFromUrl,
  setStoredWorker,
} from "../lib/workerSession.js";
import type { AppConfig, InputType } from "../types.js";

const TITLES: Record<InputType, string> = {
  work_done: "I Did Something",
  problem_found: "I Found a Problem",
  need_item: "I Need Something",
};

function resolveSelectValue(selected: string, other: string): string {
  if (selected === "Other") return other.trim() || "Other";
  return selected.trim();
}

export function WorkerForm() {
  const { action } = useParams<{ action: string }>();
  const inputType = action as InputType;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [config, setConfig] = useState<AppConfig | null>(null);
  const [worker, setWorker] = useState("");
  const [workerOther, setWorkerOther] = useState("");
  const [site, setSite] = useState("");
  const [siteOther, setSiteOther] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [followUp, setFollowUp] = useState<boolean | null>(null);
  const [safety, setSafety] = useState<boolean | null>(null);
  const [urgency, setUrgency] = useState<"low" | "normal" | "high">("normal");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (
      inputType !== "work_done" &&
      inputType !== "problem_found" &&
      inputType !== "need_item"
    ) {
      navigate("/worker", { replace: true });
    }
  }, [inputType, navigate]);

  useEffect(() => {
    void fetchConfig().then((cfg) => {
      setConfig(cfg);
      const fromUrl = parseWorkerFromUrl(searchParams.toString());
      const initial = fromUrl ?? getStoredWorker();
      if (!initial) return;
      if (cfg.workers.includes(initial)) {
        setWorker(initial);
      } else {
        setWorker("Other");
        setWorkerOther(initial);
      }
    });
  }, [searchParams]);

  if (
    !inputType ||
    (inputType !== "work_done" &&
      inputType !== "problem_found" &&
      inputType !== "need_item")
  ) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const workerName = resolveSelectValue(worker, workerOther);
    const siteName = resolveSelectValue(site, siteOther);

    if (!workerName || workerName === "Other") {
      setError("Please enter your name");
      return;
    }
    if (!siteName || siteName === "Other") {
      setError("Please choose a site");
      return;
    }
    if (!summary.trim()) {
      setError("Please fill in the required field");
      return;
    }

    if (inputType === "work_done" && followUp === null) {
      setError("Please answer if anything else is needed");
      return;
    }
    if (inputType === "problem_found" && safety === null) {
      setError("Please answer if this is safety related");
      return;
    }

    setSubmitting(true);
    setStoredWorker(workerName);

    let photoPath: string | null = null;
    if (photo && inputType === "problem_found") {
      try {
        photoPath = await uploadPhoto(photo);
      } catch {
        /* photo optional — continue without */
      }
    }

    try {
      const result = await submitLog({
        worker_name: workerName,
        site_location: siteName,
        input_type: inputType,
        summary: summary.trim(),
        details: details.trim(),
        follow_up_needed: inputType === "work_done" ? followUp === true : false,
        safety_related:
          inputType === "problem_found" ? safety === true : false,
        urgency: inputType === "need_item" ? urgency : null,
        photo_path: photoPath,
      });
      navigate("/worker/confirm", {
        replace: true,
        state: { queued: result.queued },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <Link to="/worker" className="back-link">
        ← Back
      </Link>
      <h1>{TITLES[inputType]}</h1>

      <form onSubmit={handleSubmit}>
        {config && (
          <>
            <SelectOrOther
              label="Your name"
              value={worker}
              otherValue={workerOther}
              options={config.workers}
              onChange={setWorker}
              onOtherChange={setWorkerOther}
            />
            <SelectOrOther
              label="Site / location"
              value={site}
              otherValue={siteOther}
              options={config.sites}
              onChange={setSite}
              onOtherChange={setSiteOther}
            />
          </>
        )}

        {inputType === "work_done" && (
          <>
            <div className="field">
              <label htmlFor="summary">What did you do?</label>
              <textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>
            <YesNo
              label="Anything else needed?"
              value={followUp}
              onChange={setFollowUp}
            />
          </>
        )}

        {inputType === "problem_found" && (
          <>
            <div className="field">
              <label htmlFor="summary">What is the problem?</label>
              <textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>
            <YesNo
              label="Is this safety related?"
              value={safety}
              onChange={setSafety}
            />
            <div className="field">
              <label htmlFor="photo">Photo (optional)</label>
              <input
                id="photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </div>
          </>
        )}

        {inputType === "need_item" && (
          <>
            <div className="field">
              <label htmlFor="summary">What do you need?</label>
              <input
                id="summary"
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="details">What is it for?</label>
              <textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="urgency">Urgency</label>
              <select
                id="urgency"
                value={urgency}
                onChange={(e) =>
                  setUrgency(e.target.value as "low" | "normal" | "high")
                }
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </>
        )}

        {error && (
          <p style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</p>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/worker")}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
