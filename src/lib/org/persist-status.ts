export type PersistStatus = "idle" | "saving" | "saved" | "error";

type Listener = (status: PersistStatus, error: string | null) => void;

let inFlight = 0;
let lastError: string | null = null;
let savedResetTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emit(status: PersistStatus, error: string | null) {
  lastError = error;
  for (const listener of listeners) listener(status, error);
}

export function beginPersist() {
  inFlight += 1;
  if (savedResetTimer) {
    clearTimeout(savedResetTimer);
    savedResetTimer = null;
  }
  emit("saving", null);
}

export function endPersist(ok: boolean, error?: string) {
  inFlight = Math.max(0, inFlight - 1);
  if (!ok) {
    emit(inFlight > 0 ? "saving" : "error", error ?? "Save failed");
    return;
  }
  if (inFlight > 0) {
    emit("saving", null);
    return;
  }
  emit("saved", null);
  savedResetTimer = setTimeout(() => {
    savedResetTimer = null;
    if (inFlight === 0) emit("idle", null);
  }, 1800);
}

export function getPersistStatus(): { status: PersistStatus; error: string | null } {
  if (inFlight > 0) return { status: "saving", error: null };
  return { status: lastError ? "error" : "idle", error: lastError };
}

export function subscribePersistStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isPersistInFlight() {
  return inFlight > 0;
}
