export function formatEventTime(e: any): string {
  const timeVal = e.occurredAt ?? e.createdAt;
  if (!timeVal) return "";

  try {
    // 1. Check if it's a Firestore Timestamp object { _seconds, _nanoseconds } or similar
    if (typeof timeVal === 'object' && timeVal !== null) {
      if (timeVal.toDate && typeof timeVal.toDate === 'function') {
        return timeVal.toDate().toLocaleString();
      }
      if (timeVal._seconds !== undefined) {
        return new Date(timeVal._seconds * 1000).toLocaleString();
      }
      if (timeVal.seconds !== undefined) {
        return new Date(timeVal.seconds * 1000).toLocaleString();
      }
    }

    // 2. Check if it's a number (milliseconds) or string (ISO)
    const date = new Date(timeVal);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString();
    }
  } catch (err) {
    console.error("Failed to parse event time:", timeVal, err);
  }

  return String(timeVal); // Fallback
}
