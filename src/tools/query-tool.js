import mysql from "mysql2/promise";
import { z } from "zod";

import { formatResult } from "../utils/result-format.js";
import { hasMultipleStatements, isReadonlySql, normalizeSql } from "../utils/sql-guards.js";

export function registerQueryTool(server, { dbConfig, maxRows }) {
  server.registerTool(
    "query",
    {
      title: "Read-only MySQL Query",
      description:
        "Execute a single read-only SQL query against MySQL. Supports SELECT, SHOW, DESCRIBE, EXPLAIN, WITH.",
      inputSchema: {
        sql: z.string().min(1).describe("A single read-only SQL statement."),
        database: z
          .string()
          .min(1)
          .optional()
          .describe("Optional database name to override DB_NAME for this request."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
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
}
