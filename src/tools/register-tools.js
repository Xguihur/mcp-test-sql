import { registerDescribeTableTool } from "./describe-table-tool.js";
import { registerQueryTool } from "./query-tool.js";

export function registerTools(server, context) {
  registerDescribeTableTool(server, context);
  registerQueryTool(server, context);
}
