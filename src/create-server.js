import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createRuntimeConfig } from "./config/runtime.js";
import { registerTools } from "./tools/register-tools.js";

export function createServer() {
  const server = new McpServer({
    name: "db-readonly",
    version: "1.0.0",
  });

  const runtimeConfig = createRuntimeConfig();
  registerTools(server, runtimeConfig);

  return server;
}
