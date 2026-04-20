function validateDate(dateStr: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "INVALID FORMAT";
  const parsedDate = new Date(`${dateStr}T00:00:00Z`);
  const roundTripStr = parsedDate.toISOString().split("T")[0];
  if (dateStr !== roundTripStr) return "NOT REAL DATE";
  return "OK";
}
console.log("2026-02-28", validateDate("2026-02-28"));
console.log("2026-02-31", validateDate("2026-02-31"));
console.log("2026-04-18", validateDate("2026-04-18"));
console.log("2026-13-01", validateDate("2026-13-01"));
