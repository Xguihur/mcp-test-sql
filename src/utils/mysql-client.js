import mysql from "mysql2/promise";

export function resolveDatabaseName(dbConfig, database) {
  return database || dbConfig.database || "";
}

export async function executeQuery({ dbConfig, sql, database, values = [] }) {
  const connectionConfig = {
    ...dbConfig,
    ...(database ? { database } : {}),
  };

  let connection;

  try {
    connection = await mysql.createConnection(connectionConfig);
    const [rows] = await connection.query(sql, values);
    return rows;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
