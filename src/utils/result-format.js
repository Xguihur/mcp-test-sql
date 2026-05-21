export function formatResult(rows, maxRows) {
  if (!Array.isArray(rows)) {
    return JSON.stringify(rows, null, 2);
  }

  if (rows.length <= maxRows) {
    return JSON.stringify(rows, null, 2);
  }

  const preview = rows.slice(0, maxRows);
  return [
    JSON.stringify(preview, null, 2),
    "",
    `-- Result truncated: showing ${maxRows} of ${rows.length} rows.`,
  ].join("\n");
}
