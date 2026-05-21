# db-readonly-mcp

一个最小可运行的只读 MySQL MCP Server 示例，按你给的掘金文章案例落地，但暂时不包含任何客户端接入配置。

当前版本已经整理成“单一入口 + 多 tool 可扩展”的结构，并使用 SDK 推荐的 `registerTool(...)` 方式注册 tool。

## 功能

- 暴露两个只读 tool：`query` 和 `describe_table`
- 只允许执行只读 SQL：`SELECT`、`SHOW`、`DESCRIBE`、`EXPLAIN`、`WITH`
- 禁止多语句执行
- 支持用 `database` 参数临时覆盖默认库
- 查询结果超过 `MAX_ROWS` 时自动截断
- 为后续新增更多 tool 预留了统一注册入口

## 文件说明

- `index.js`：启动入口，只负责加载环境变量、创建 server、连接 transport
- `src/create-server.js`：创建 `McpServer` 并装配运行时配置
- `src/tools/register-tools.js`：统一注册所有 tool
- `src/tools/describe-table-tool.js`：`describe_table` tool 的定义与业务逻辑
- `src/tools/query-tool.js`：`query` tool 的定义与业务逻辑
- `src/utils/mysql-client.js`：数据库连接、查询执行与默认库解析
- `src/utils/sql-guards.js`：SQL 清洗与只读安全校验
- `src/utils/result-format.js`：结果格式化
- `.env.example`：数据库配置占位文件
- `package.json`：依赖与脚本
- `docs/`：实现说明与 MCP / Zod 学习笔记

## 当前结构

```text
db-readonly-mcp/
├── index.js
├── src/
│   ├── create-server.js
│   ├── config/
│   │   └── runtime.js
│   ├── tools/
│   │   ├── describe-table-tool.js
│   │   ├── query-tool.js
│   │   └── register-tools.js
│   └── utils/
│       ├── mysql-client.js
│       ├── result-format.js
│       └── sql-guards.js
└── docs/
```

## 使用方式

1. 安装依赖

```bash
npm install
```

1. 复制环境变量模板

```bash
cp .env.example .env
```

1. 按需填写数据库配置

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=your_default_database
MAX_ROWS=200
```

1. 启动服务

```bash
npm start
```

## Claude Code 配置

推荐直接用用户级命令注册：

```bash
claude mcp add -s user db-readonly \
  --env DB_HOST=localhost \
  --env DB_PORT=3306 \
  --env DB_USER=root \
  --env DB_PASSWORD=your_password \
  --env DB_NAME=your_default_database \
  -- node /Users/xiaolongxia/Desktop/AI/db-readonly-mcp/index.js
```

Claude Code 会把它写入 `~/.claude.json`。等价配置如下：

```json
{
  "mcpServers": {
    "db-readonly": {
      "type": "stdio",
      "command": "node",
      "args": ["/*/db-readonly-mcp/index.js"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "3306",
        "DB_USER": "root",
        "DB_PASSWORD": "your_password",
        "DB_NAME": "your_default_database"
      }
    }
  }
}
```

不要再把 `mcpServers` 写到 `~/.claude/settings.json`。配置完成后重启 Claude Code session，让客户端重新加载这个 MCP Server。

## 测试触发

推荐先测两种方式：

- 强触发：明确要求 agent 调用 MCP
  - `请调用 MCP 工具 describe_table 查看 users 表结构，并整理字段信息给我。`
  - `请调用 MCP 工具 query 执行 SELECT COUNT(*) AS total FROM users，并告诉我结果。`
- 自然触发：只提业务问题，让 agent 自己决定是否调用
  - `users 表有哪些字段？`
  - `users 表现在有多少条数据？`

如果配置成功，Claude Code 里应该能看到类似 `mcp__db-readonly__describe_table` 或 `mcp__db-readonly__query` 的工具调用记录。

## Tool 设计

当前实现两个 tool：

- `query`
  - 入参：
    - `sql`：只读 SQL
    - `database`：可选，临时覆盖默认数据库
  - 返回：
    - 文本格式 JSON 查询结果
- `describe_table`
  - 入参：
    - `table`：要查看结构的表名
    - `database`：可选，临时覆盖默认数据库
  - 返回：
    - 表字段结构的文本格式 JSON 结果

## 后续如何新增 tool

推荐流程：

1. 在 `src/tools/` 下新增一个独立文件，比如 `list-tables-tool.js`
2. 在这个文件里用 `server.registerTool(...)` 定义新 tool
3. 在 `src/tools/register-tools.js` 里统一注册它
4. 如果多个 tool 共用逻辑，再把公共逻辑放进 `src/utils/` 或 `src/config/`

这样做的好处是：

- `index.js` 不会越长越乱
- 每个 tool 的边界更清楚
- 后面要拆测试、拆权限、拆文档都更方便

## 说明

- 这个项目本身不需要模型 token。
- 后续如果你要接入 Claude Code、Codex 或其他 MCP Client，再在客户端侧配置启动命令和环境变量即可。
- 当前实现是文章案例的工程化版本，保留了最小结构，同时补了多语句拦截、结果截断、表结构查看能力，以及面向多 tool 的组织方式，便于直接继续扩展。

