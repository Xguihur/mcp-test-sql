# `index.js` 与 Tool 注册调用流程图

这份文档专门解释 [index.js](/Users/xiaolongxia/Desktop/AI/db-readonly-mcp/index.js) 和 `src/` 下面几个关键模块是怎么串起来工作的。

## 总览

这个文件的调用可以分成两段：

1. 启动阶段：读取环境变量，创建 server，统一注册 tool，建立 `stdio` 通信。
2. 查询阶段：当客户端调用 `query` 时，先做 SQL 清洗和安全校验，再连 MySQL 执行查询，最后格式化结果并返回。

## 启动阶段

```mermaid
flowchart TD
    A["index.js<br/>加载 dotenv 与 transport"] --> B["main()"]
    B --> C["createServer()"]
    C --> D["new McpServer(...)"]
    D --> E["createRuntimeConfig()"]
    E --> F["构造 dbConfig 与 maxRows"]
    F --> G["registerTools(server, context)"]
    G --> H["registerQueryTool(server, context)"]
    H --> I["server.registerTool('query', config, handler)"]
    I --> J["new StdioServerTransport()"]
    J --> K["server.connect(transport)"]
    K --> L["进程进入等待状态<br/>等待 MCP 客户端调用 query"]
```

## 查询阶段

```mermaid
flowchart TD
    A["客户端调用 query(sql, database)"] --> B["handler 开始执行"]
    B --> C["normalizeSql(sql)"]
    C --> D["stripLeadingComments(sql)<br/>去掉开头注释"]
    D --> E{"cleanedSql 为空?"}
    E -- "是" --> E1["返回错误<br/>SQL is empty after trimming comments"]
    E -- "否" --> F["hasMultipleStatements(sql)"]
    F --> G["normalizeSql(sql)"]
    G --> H{"是否包含额外分号?"}
    H -- "是" --> H1["返回错误<br/>only a single SQL statement is allowed"]
    H -- "否" --> I["isReadonlySql(cleanedSql)"]
    I --> J["normalizeSql(cleanedSql).toUpperCase()"]
    J --> K{"前缀是否在<br/>SELECT/SHOW/DESCRIBE/EXPLAIN/WITH 中?"}
    K -- "否" --> K1["返回错误<br/>only read-only queries are allowed"]
    K -- "是" --> L["构造 connectionConfig"]
    L --> M["mysql.createConnection(connectionConfig)"]
    M --> N["connection.query(cleanedSql)"]
    N --> O["formatResult(rows, maxRows)"]
    O --> P["返回成功结果"]
    M -. "异常" .-> Q["catch(error)<br/>返回 Query failed"]
    N -. "异常" .-> Q
    P --> R["finally: connection.end()"]
    Q --> R
```

## 工具函数关系

```mermaid
flowchart LR
    A["createRuntimeConfig()"] --> A1["把环境变量组装成运行时配置"]
    B["stripLeadingComments(sql)"] --> B1["移除 SQL 开头的 -- / # / /* */ 注释"]
    C["normalizeSql(sql)"] --> B
    C --> C1["去尾部分号并 trim"]
    D["hasMultipleStatements(sql)"] --> C
    E["isReadonlySql(sql)"] --> C
    F["formatResult(rows, maxRows)"] --> F1["结果太长时截断"]
    G["registerQueryTool(server, context)"] --> G1["统一定义 query 的 schema、annotations、handler"]
```

## 逐个方法看职责

- `createRuntimeConfig()`
  读取 `.env`，构造工具执行时会用到的 `dbConfig` 和 `maxRows`。这样后面新增其他 tool 时，也能共享同一套运行时配置。

- `stripLeadingComments(sql)`
  把 SQL 最前面的注释剥掉，避免 `-- comment` 或 `/* ... */` 影响后面的安全判断。

- `normalizeSql(sql)`
  先调用 `stripLeadingComments()`，再去掉尾部多余分号和空白。这个函数是后续校验的基础。

- `hasMultipleStatements(sql)`
  基于 `normalizeSql()` 的结果检查内部是否还有分号；有的话就认为可能是多语句，直接拒绝。

- `isReadonlySql(sql)`
  基于 `normalizeSql()` 的结果判断 SQL 是否以允许的只读前缀开头。

- `formatResult(rows, maxRows)`
  把查询结果转成 JSON 文本；如果结果行数太多，只返回前 `maxRows` 行并追加截断提示。

- `registerQueryTool(server, context)`
  这是 `query` tool 的注册函数。它内部使用 `server.registerTool(...)` 声明 tool 名称、描述、参数 schema、annotations 和 handler。

- `registerTools(server, context)`
  这是统一注册入口。以后新增 tool 时，通常只需要在这里多注册一个函数，而不需要让 `index.js` 持续变大。

- `main()`
  只负责创建 `StdioServerTransport` 并把 server 接上去，让这个进程可以通过 `stdin/stdout` 跟 MCP 客户端通信。

## 你看代码时可以抓住的主线

最值得记的一条主线其实很简单：

`main()` 启动服务  
`createServer()` 创建并装配 server  
`registerTools()` 统一挂载能力  
`server.registerTool()` 暴露能力  
`handler` 接请求  
`normalizeSql / hasMultipleStatements / isReadonlySql` 做安全校验  
`mysql.createConnection + query` 执行数据库操作  
`formatResult` 整理结果  
`finally` 负责收尾关闭连接

## 为什么我把图放在 `docs/`

- 这是实现说明，不是运行入口，放在 `docs/` 比放根目录更清晰。
- 后面如果你继续加 `list_tables`、`describe_table`、`resources`，可以继续把更多流程图放进同一个目录。
- `README.md` 保持“怎么运行”，`docs/` 负责“怎么理解”，职责更分明。
