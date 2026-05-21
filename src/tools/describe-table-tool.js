import { z } from "zod";

import { formatResult } from "../utils/result-format.js";
import { executeQuery, resolveDatabaseName } from "../utils/mysql-client.js";

const DESCRIBE_TABLE_SQL = `
SELECT
  COLUMN_NAME AS column_name,
  COLUMN_TYPE AS column_type,
  IS_NULLABLE AS is_nullable,
  COLUMN_KEY AS column_key,
  COLUMN_DEFAULT AS column_default,
  EXTRA AS extra,
  COLUMN_COMMENT AS column_comment
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
ORDER BY ORDINAL_POSITION
`;

export function registerDescribeTableTool(server, { dbConfig, maxRows }) {
  server.registerTool(
    "describe_table",
    {
      title: "Describe MySQL Table",
      description:
        "Show the schema of a MySQL table, including column names, types, nullability, keys, defaults, extras, and comments.",
      inputSchema: {
        table: z.string().min(1).describe("Table name to inspect."),
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
    async ({ table, database }) => {
      const resolvedDatabase = resolveDatabaseName(dbConfig, database);

      if (!resolvedDatabase) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Rejected: database is required for describe_table when DB_NAME is not configured.",
            },
          ],
        };
      }

      try {
        const rows = await executeQuery({
          dbConfig,
          sql: DESCRIBE_TABLE_SQL,
          database: resolvedDatabase,
          values: [resolvedDatabase, table],
        });

        if (!Array.isArray(rows) || rows.length === 0) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Table not found: ${resolvedDatabase}.${table}`,
              },
            ],
          };
        }

        return {
          content: [{ type: "text", text: formatResult(rows, maxRows) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Describe table failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
