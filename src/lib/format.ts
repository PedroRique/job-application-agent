const timeZone = "America/Sao_Paulo";

export function formatShortDate(iso: string) {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  }).format(date);
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone }).format(date);
  const currentYear = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone }).format(
    new Date(),
  );
  return year === currentYear ? day : `${day}, ${year}`;
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}
