const DEFAULT_PORT = 3306;
const DEFAULT_MAX_ROWS = 200;

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function createRuntimeConfig() {
  return {
    dbConfig: {
      host: process.env.DB_HOST || "localhost",
      port: parseInteger(process.env.DB_PORT, DEFAULT_PORT),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "",
      multipleStatements: false,
    },
    maxRows: parseInteger(process.env.MAX_ROWS, DEFAULT_MAX_ROWS),
  };
}
