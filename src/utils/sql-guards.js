const READONLY_PREFIXES = ["SELECT", "SHOW", "DESCRIBE", "EXPLAIN", "WITH"];

export function stripLeadingComments(sql) {
  let text = sql.trim();

  while (text.length > 0) {
    if (text.startsWith("--")) {
      const nextLine = text.indexOf("\n");
      text = nextLine === -1 ? "" : text.slice(nextLine + 1).trimStart();
      continue;
    }

    if (text.startsWith("#")) {
      const nextLine = text.indexOf("\n");
      text = nextLine === -1 ? "" : text.slice(nextLine + 1).trimStart();
      continue;
    }

    if (text.startsWith("/*")) {
      const commentEnd = text.indexOf("*/");
      text = commentEnd === -1 ? "" : text.slice(commentEnd + 2).trimStart();
      continue;
    }

    break;
  }

  return text;
}

export function normalizeSql(sql) {
  return stripLeadingComments(sql).replace(/;+\s*$/u, "").trim();
}

export function hasMultipleStatements(sql) {
  return normalizeSql(sql).includes(";");
}

export function isReadonlySql(sql) {
  const normalized = normalizeSql(sql).toUpperCase();
  return READONLY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
