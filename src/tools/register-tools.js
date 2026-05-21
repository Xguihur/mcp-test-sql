import { registerQueryTool } from "./query-tool.js";

export function registerTools(server, context) {
  registerQueryTool(server, context);
}
