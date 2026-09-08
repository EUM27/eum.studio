

export function createTimeZoneDateKey(
  timezone: string,
): (timestamp: string) => string {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (timestamp) => {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) {
      throw new Error(`Invalid Work records timestamp: ${timestamp}`);
    }
    const parts = new Map(
      formatter
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    const year = parts.get("year");
    const month = parts.get("month");
    const day = parts.get("day");
    if (year === undefined || month === undefined || day === undefined) {
      throw new Error("Work records calendar date could not be derived");
    }
    return `${year}-${month}-${day}`;
  };
}

