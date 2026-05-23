const WORKER_KEY = "fieldpulse_worker";

export function getStoredWorker(): string {
  return sessionStorage.getItem(WORKER_KEY) ?? "";
}

export function setStoredWorker(name: string): void {
  if (name) {
    sessionStorage.setItem(WORKER_KEY, name);
  }
}

export function parseWorkerFromUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  const worker = params.get("worker");
  if (worker) {
    setStoredWorker(worker);
    return worker;
  }
  return null;
}

export function parseActionFromUrl(
  search: string
): "work_done" | "problem_found" | "need_item" | null {
  const action = new URLSearchParams(search).get("action");
  if (
    action === "work_done" ||
    action === "problem_found" ||
    action === "need_item"
  ) {
    return action;
  }
  return null;
}
