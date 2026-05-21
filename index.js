import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import mysql from "mysql2/promise";
import { z } from "zod";

const DEFAULT_PORT = 3306;
const DEFAULT_MAX_ROWS = 200;
const READONLY_PREFIXES = ["SELECT", "SHOW", "DESCRIBE", "EXPLAIN", "WITH"];

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function stripLeadingComments(sql) {
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

function normalizeSql(sql) {
  return stripLeadingComments(sql).replace(/;+\s*$/u, "").trim();
}

function hasMultipleStatements(sql) {
  return normalizeSql(sql).includes(";");
}

function isReadonlySql(sql) {
  const normalized = normalizeSql(sql).toUpperCase();
  return READONLY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function formatResult(rows, maxRows) {
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

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInteger(process.env.DB_PORT, DEFAULT_PORT),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "",
  multipleStatements: false,
};

const maxRows = parseInteger(process.env.MAX_ROWS, DEFAULT_MAX_ROWS);

const server = new McpServer({
  name: "db-readonly",
  version: "1.0.0",
});

server.tool(
  "query",
  "Execute a single read-only SQL query against MySQL. Supports SELECT, SHOW, DESCRIBE, EXPLAIN, WITH.",
  {
    sql: z.string().min(1).describe("A single read-only SQL statement."),
    database: z
      .string()
      .min(1)
      .optional()
      .describe("Optional database name to override DB_NAME for this request."),
  },
  async ({ sql, database }) => {
    const cleanedSql = normalizeSql(sql);

    if (!cleanedSql) {
      return {
        isError: true,
        content: [{ type: "text", text: "Rejected: SQL is empty after trimming comments." }],
      };
    }

    if (hasMultipleStatements(sql)) {
      return {
        isError: true,
        content: [{ type: "text", text: "Rejected: only a single SQL statement is allowed." }],
      };
    }

    if (!isReadonlySql(cleanedSql)) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Rejected: only read-only queries are allowed (SELECT, SHOW, DESCRIBE, EXPLAIN, WITH).",
          },
        ],
      };
    }

    const connectionConfig = {
      ...dbConfig,
      ...(database ? { database } : {}),
    };

    let connection;

    try {
      connection = await mysql.createConnection(connectionConfig);
      const [rows] = await connection.query(cleanedSql);

      return {
        content: [{ type: "text", text: formatResult(rows, maxRows) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Query failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start db-readonly MCP server:", error);
  process.exit(1);
});
