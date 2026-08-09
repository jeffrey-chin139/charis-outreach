export function startOfLocalDate(date: string) {
  return `${date}T00:00:00.000`;
}

export function endOfLocalDate(date: string) {
  return `${date}T23:59:59.999`;
}
