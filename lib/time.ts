export function safeTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "Asia/Dubai";
  }
}

export function zonedDayRange(timeZone: string, now = Date.now()) {
  const zone = safeTimeZone(timeZone);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
  const start = zonedMidnight(day, zone);
  return { start, end: start + 24 * 60 * 60 * 1000 - 1 };
}

function zonedMidnight(day: string, timeZone: string) {
  const [year, month, date] = day.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, date, 0, 0, 0);
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcGuess));
  const pick = (type: string) => Number(formatted.find((part) => part.type === type)?.value || 0);
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour") % 24, pick("minute"), pick("second"));
  return utcGuess - (asUtc - utcGuess);
}
