const CLASSES_CHANGED_EVENT = "teacher:classes-changed";

// The teacher sidebar lists classes but lives in the persistent layout, so it never
// remounts (and never refetches) when a class is created, renamed, or deleted from a
// page nested inside it. Pages call notifyClassesChanged() after such a mutation so
// the sidebar can refresh immediately instead of only after a full page reload.
export function notifyClassesChanged() {
  window.dispatchEvent(new Event(CLASSES_CHANGED_EVENT));
}

export function onClassesChanged(handler: () => void) {
  window.addEventListener(CLASSES_CHANGED_EVENT, handler);
  return () => window.removeEventListener(CLASSES_CHANGED_EVENT, handler);
}
