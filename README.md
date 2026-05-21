# db-readonly-mcp

一个最小可运行的只读 MySQL MCP Server 示例，按你给的掘金文章案例落地，但暂时不包含任何客户端接入配置。

## 功能

- 暴露一个 `query` tool
- 只允许执行只读 SQL：`SELECT`、`SHOW`、`DESCRIBE`、`EXPLAIN`、`WITH`
- 禁止多语句执行
- 支持用 `database` 参数临时覆盖默认库
- 查询结果超过 `MAX_ROWS` 时自动截断

## 文件说明

- `index.js`：MCP Server 主程序
- `.env.example`：数据库配置占位文件
- `package.json`：依赖与脚本

## 使用方式

1. 安装依赖

```bash
npm install
```

2. 复制环境变量模板

```bash
cp .env.example .env
```

3. 按需填写数据库配置

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=your_default_database
MAX_ROWS=200
```

4. 启动服务

```bash
npm start
```

## Tool 设计

当前仅实现一个 tool：

- `query`
  - 入参：
    - `sql`：只读 SQL
    - `database`：可选，临时覆盖默认数据库
  - 返回：
    - 文本格式 JSON 查询结果

## 说明

- 这个项目本身不需要模型 token。
- 后续如果你要接入 Claude Code、Codex 或其他 MCP Client，再在客户端侧配置启动命令和环境变量即可。
- 当前实现是文章案例的工程化版本，保留了最小结构，同时补了多语句拦截和结果截断，便于直接继续扩展。
