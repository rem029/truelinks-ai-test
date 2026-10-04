function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function monthsBetween(commencement: string, expiry: string): number | null {
  const start = parseIsoDate(commencement);
  const end = parseIsoDate(expiry);
  if (!start || !end) return null;
  if (end.getTime() <= start.getTime()) return null;

  // Residential lease expiry is inclusive; advance by one day to evaluate the full term boundary.
  const nextDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1));

  // The span is a whole number of months if the start day matches the boundary day.
  if (start.getUTCDate() !== nextDay.getUTCDate()) {
    return null;
  }

  const months =
    (nextDay.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (nextDay.getUTCMonth() - start.getUTCMonth());

  return months > 0 ? months : null;
}
