function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const raw = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
  if (raw.includes(",") || raw.includes('"') || /[\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function rowsToCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ];
  return lines.join("\n");
}
