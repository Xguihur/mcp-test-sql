---
title: MCP Tool 方法与 Zod 校验说明
aliases:
  - MCP Tool 方法说明
  - Zod 校验说明
tags:
  - mcp
  - typescript
  - zod
  - obsidian-note
created: 2026-05-21
sdk_version: 1.29.0
zod_version: 3.25.76
---

# MCP Tool 方法与 Zod 校验说明

这份笔记专门解释当前项目里 [query-tool.js](/Users/xiaolongxia/Desktop/AI/db-readonly-mcp/src/tools/query-tool.js) 和 [describe-table-tool.js](/Users/xiaolongxia/Desktop/AI/db-readonly-mcp/src/tools/describe-table-tool.js) 使用的 `server.registerTool(...)` 是怎么用的，它有哪些参数，以及 `z` 也就是 `zod` 这个校验库在这里扮演什么角色。

配合 [[index-method-call-flow]] 和 [[describe-table-tool-guide]] 一起看会更完整。

> [!info] 这份说明基于当前项目实际安装版本
> - `@modelcontextprotocol/sdk`: `1.29.0`
> - `zod`: `3.25.76`
> - 当前项目示例已经使用 `server.registerTool(...)`
> - `tool(...)` 在这个 SDK 版本里已经是 `deprecated`
> - 当前项目里已经有两个实际示例：`query` 和 `describe_table`

## 先看你项目里的两种实际写法

```js
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
    // 业务逻辑
  }
);
```

这 3 段分别代表：

| 位置 | 当前值 | 作用 |
| --- | --- | --- |
| 第 1 个参数 | `"query"` | tool 名字。MCP 客户端真正调用的就是这个名字。 |
| 第 2 个参数 | 一个 config 对象 | 放 `title`、`description`、`inputSchema`、`annotations` 等配置。 |
| 第 3 个参数 | `async ({ sql, database }) => {}` | handler。当前 tool 被调用时，真正执行的业务逻辑。 |

另一个更语义化的例子是 `describe_table`：

```js
server.registerTool(
  "describe_table",
  {
    title: "Describe MySQL Table",
    description: "Show the schema of a MySQL table.",
    inputSchema: {
      table: z.string().min(1).describe("Table name to inspect."),
      database: z.string().min(1).optional().describe("Optional database override"),
    },
  },
  async ({ table, database }) => {
    // 业务逻辑
  }
);
```

这个例子特别适合学 `registerTool(...)`，因为它比 `query` 更容易看出“tool 名称、参数、业务意图”之间是一一对应的。

## `server.registerTool(...)` 到底有哪些参数

> [!note]
> 当前项目现在使用的是推荐写法：

```ts
registerTool(name, config, handler)
```

### 1. `name`

类型：`string`

作用：

- 定义 tool 的唯一名字。
- 客户端会通过这个名字调用它。
- 这个名字应该简洁、稳定、表达清楚动作。

在你项目里：

```js
"query"
```

含义就是“执行数据库查询”。

另一个真实例子是：

```js
"describe_table"
```

含义就是“查看某张表的结构”。

### 2. `config`

这是 `registerTool(...)` 最关键的变化点。

它把原来散落的参数收进了一个对象里，便于以后继续扩字段。

你当前项目里主要用到了这些字段：

| 字段 | 当前值 | 作用 |
| --- | --- | --- |
| `title` | `"Read-only MySQL Query"` | 更适合给人看的名字。 |
| `description` | 一段说明文本 | 告诉模型和客户端这个 tool 是做什么的。 |
| `inputSchema` | `sql` / `database` 的 `zod` schema | 定义输入参数。 |
| `annotations` | `readOnlyHint` 等 | 提示这个 tool 的行为特征。 |

### 2.1 `title`

类型：`string`

作用：

- 给人类界面一个更好读的标题。
- 不一定等于 tool name。

### 2.2 `description`

类型：`string`

作用：

- 让模型知道这个 tool 适合做什么。
- 说明越清楚，模型越不容易误用。
- 通常应该写出用途、限制、支持的参数范围。

在你项目里：

```js
"Execute a single read-only SQL query against MySQL. Supports SELECT, SHOW, DESCRIBE, EXPLAIN, WITH."
```

这段话已经做了两件很重要的事：

- 告诉模型这是 MySQL 查询工具。
- 明确告诉模型它只能做只读查询。

而 `describe_table` 的 `description` 则更偏向“明确能力边界”：

- 它不是通用 SQL 工具。
- 它只做一件事：查看表结构。
- 这种更语义化的 tool，通常更适合作为教程里的第二个示例。

### 2.3 `inputSchema`

类型：

- 在 `registerTool(...)` 里，通常也是“一个对象”，对象的每个字段都是 `zod` schema。
- 也就是这种风格：

```js
{
  sql: z.string(),
  database: z.string().optional()
}
```

作用：

- 定义这个 tool 接受哪些参数。
- 定义每个参数是什么类型。
- 定义参数是不是必填。
- 定义参数有没有额外限制，比如最小长度、最大值、枚举值。
- SDK 会把它转换成客户端可理解的 `inputSchema`。

在你项目里：

```js
{
  sql: z.string().min(1).describe("A single read-only SQL statement."),
  database: z.string().min(1).optional().describe("Optional database name to override DB_NAME for this request."),
}
```

这表示：

- `sql` 是必填字符串，而且不能为空字符串。
- `database` 是可选字符串；如果传了，也不能为空。

`describe_table` 的 `inputSchema` 也是同一个模式，只是字段换成了：

- `table`
- `database`

这正好说明：MCP tool 的变化点往往主要就在 `inputSchema` 和 handler 逻辑。

### 2.4 `annotations`

类型：`ToolAnnotations`

作用：

- 给 tool 补充一些“行为提示型元数据”。
- 它不负责业务逻辑，主要是告诉客户端或模型这个工具大概有什么副作用。

当前 SDK 里常见字段包括：

| 字段 | 作用 |
| --- | --- |
| `title` | 人类更容易读懂的标题。 |
| `readOnlyHint` | 提示这个 tool 是否只读。 |
| `destructiveHint` | 提示它是否可能做破坏性修改。 |
| `idempotentHint` | 提示同样参数重复调用是否不会产生额外副作用。 |
| `openWorldHint` | 提示它是否会与开放外部世界交互，比如 Web 搜索这类工具。 |

你当前项目已经传了 `annotations`。如果以后你想继续沿着这套模式扩新的只读工具，可以这样写：

```js
server.registerTool(
  "query",
  {
    description: "Execute a single read-only SQL query against MySQL.",
    inputSchema: {
      sql: z.string().min(1),
      database: z.string().optional(),
    },
    title: "Read-only MySQL Query",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ sql, database }) => {
    // ...
  }
);
```

### 3. `cb` / `handler`

类型：一个函数，通常是 `async`

它才是真正执行业务逻辑的入口。

在有参数 schema 的情况下，常见签名是：

```js
async (args, extra) => {
  // ...
}
```

在你项目里它被写成：

```js
async ({ sql, database }) => {
  // ...
}
```

也就是把 `args` 直接解构了。

## handler 里的两个参数分别是什么

### 第一个参数：`args`

这是已经通过 schema 校验后的参数对象。

在你这个项目里：

```js
async ({ sql, database }) => {
  // sql 和 database 都来自客户端入参
}
```

你可以把它理解成：

- 客户端传进来的原始 JSON
- 先经过 SDK + Zod 校验
- 校验通过后，才会进入这个 handler

所以这里拿到的 `sql` 和 `database`，已经满足你 schema 里定义的基本规则了。

### 第二个参数：`extra`

你的当前代码没有用到它，但它很有用。

SDK 的示例里可以看到，`extra` 常用来做这些事：

- `extra.signal`
  用来判断当前调用有没有被取消。

- `extra.sendNotification(...)`
  用来在长任务执行过程中给客户端发进度通知。

- `extra._meta?.progressToken`
  配合进度通知一起使用。

- `extra.sessionId`
  拿到当前会话 ID，常见于 HTTP / SSE 场景。

一个简化示意：

```js
server.registerTool(
  "count",
  {
    description: "Count to N with progress updates",
    inputSchema: { n: z.number().int().min(1).max(100) },
  },
  async ({ n }, extra) => {
    if (extra.signal.aborted) {
      return { content: [{ type: "text", text: "Cancelled" }], isError: true };
    }

    await extra.sendNotification({
      method: "notifications/progress",
      params: {
        progressToken: extra._meta?.progressToken,
        progress: 1,
        total: n,
      },
    });

    return { content: [{ type: "text", text: `Counted to ${n}` }] };
  }
);
```

> [!tip]
> 你现在这个 MySQL 查询工具不需要 `extra` 也完全没问题。只有当你以后想做“进度通知”“可取消任务”“会话相关操作”时，才会更常用到它。

## handler 应该返回什么

当前项目里返回的是这种结构：

```js
return {
  content: [{ type: "text", text: formatResult(rows, maxRows) }],
};
```

如果出错，则是：

```js
return {
  isError: true,
  content: [{ type: "text", text: "Rejected: only a single SQL statement is allowed." }],
};
```

这里最重要的几个字段是：

| 字段 | 作用 |
| --- | --- |
| `content` | 返回给客户端看的内容。最常见的是文本内容。 |
| `isError` | 标记这次调用是不是错误。 |
| `structuredContent` | 当你定义了 `outputSchema` 后，可以返回结构化数据。 |

> [!example]
> 如果以后你不只是想返回一段文本，而是希望返回一份结构化对象给客户端消费，可以考虑 `outputSchema + structuredContent` 这套模式。

## 为什么这里要用 `z`

这里的 `z` 来自：

```js
import { z } from "zod";
```

它是 `zod` 这个校验库的入口对象。

你可以把 `zod` 理解成：

- 一个“参数定义器”
- 一个“运行时校验器”
- 一个“类型说明器”

在 MCP 里它特别适合做 tool 参数定义，因为它同时解决了两件事：

1. 给你的代码做输入校验。
2. 给 MCP 客户端暴露一份结构化的参数说明。

## 你这个项目里 `zod` 是怎么用的

### `z.string()`

表示“这是一个字符串”。

```js
z.string()
```

### `.min(1)`

表示字符串长度至少是 1。

```js
z.string().min(1)
```

在这里它的作用是避免传入空字符串。

### `.optional()`

表示这个字段不是必填。

```js
z.string().optional()
```

如果没有 `.optional()`，这个字段默认就是必填。

### `.describe(...)`

给字段补充说明文本。

```js
z.string().describe("A single read-only SQL statement.")
```

这个描述不只是写给人看，在 MCP 场景里也会帮助客户端理解参数含义。

## `zod` 最常见的几种写法

### 字符串

```js
z.string()
z.string().min(1)
z.string().max(100)
```

### 数字

```js
z.number()
z.number().int()
z.number().min(1).max(100)
```

### 布尔值

```js
z.boolean()
```

### 枚举

```js
z.enum(["dev", "test", "prod"])
```

### 数组

```js
z.array(z.string())
```

### 对象

```js
z.object({
  host: z.string(),
  port: z.number().int(),
})
```

## 当前这个 MCP 示例里，schema 最关键的价值是什么

你这里最关键的不是“类型体操”，而是这三件事：

1. 明确告诉客户端：这个 tool 只接受 `sql` 和 `database`，或者像 `describe_table` 那样只接受 `table` 和 `database`。
2. 明确告诉 SDK：哪些字段必填，哪些可选。
3. 在业务逻辑执行前，先挡掉明显不合法的输入。

换句话说，`zod` 负责“入口检查”，而你的这些 SQL 工具函数负责“业务安全检查”。

它们的分工可以理解为：

| 层次 | 负责什么 |
| --- | --- |
| `zod` schema | 检查参数结构和基本格式，比如是不是字符串、是不是可选、是不是空串。 |
| `normalizeSql / hasMultipleStatements / isReadonlySql` | 检查业务规则，比如是不是多语句、是不是只读 SQL。 |

## 为什么 `registerTool(...)` 比 `tool(...)` 更适合继续扩展

> [!warning]
> 在你当前安装的 `@modelcontextprotocol/sdk 1.29.0` 里，`tool(...)` 已经被标记为废弃接口。新代码更推荐使用 `registerTool(...)`。

推荐写法大致是：

```js
server.registerTool(
  "query",
  {
    title: "Read-only MySQL Query",
    description: "Execute a single read-only SQL query against MySQL.",
    inputSchema: {
      sql: z.string().min(1).describe("A single read-only SQL statement."),
      database: z.string().min(1).optional().describe("Optional database override"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ sql, database }, extra) => {
    // 业务逻辑
    return {
      content: [{ type: "text", text: `Would run: ${sql}` }],
    };
  }
);
```

### `registerTool(...)` 的配置对象里常见字段

| 字段 | 作用 |
| --- | --- |
| `title` | 更适合给人看的标题。 |
| `description` | 描述这个 tool 做什么。 |
| `inputSchema` | 输入参数 schema。 |
| `outputSchema` | 结构化输出 schema。 |
| `annotations` | 行为提示元数据。 |
| `_meta` | 更底层的扩展元数据，一般先不用。 |

## `tool(...)` 和 `registerTool(...)` 怎么选

当前项目已经选用了 `registerTool(...)`，后面继续新增 tool 时也建议保持同一套风格。

因为它：

- 语义更清楚
- 可扩展字段更集中
- 更符合当前 SDK 的推荐方向

## 放回你这个项目里，应该怎么理解

把 [query-tool.js](/Users/xiaolongxia/Desktop/AI/db-readonly-mcp/src/tools/query-tool.js) 或 [describe-table-tool.js](/Users/xiaolongxia/Desktop/AI/db-readonly-mcp/src/tools/describe-table-tool.js) 里的代码翻译成一句人话就是：

> 向 MCP 客户端注册一个叫 `query` 或 `describe_table` 的工具。  
> 它的 config 里定义了标题、描述、参数 schema 和只读行为提示。  
> SDK 先用 `zod` 校验参数，再把校验后的值交给 handler。  
> handler 再继续做 SQL 清洗、只读判断、数据库执行和结果返回。

## 你后面扩展这个项目时的建议

> [!success]
> 如果你接下来要继续加 tool，可以直接照这个模式扩：
>
> 1. 先决定 tool 名字和 config.description  
> 2. 用 `zod` 把输入参数写清楚  
> 3. 在 handler 里做业务逻辑  
> 4. 能用 schema 挡掉的基础问题，尽量不要留到业务逻辑里再处理

比如你现在项目里已经有一个更适合作为教学示例的版本：

```js
server.registerTool(
  "describe_table",
  {
    description: "Describe a MySQL table schema",
    inputSchema: {
      table: z.string().min(1).describe("Table name"),
      database: z.string().optional().describe("Optional database override"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
    },
  },
  async ({ table, database }) => {
    return {
      content: [{ type: "text", text: `Would describe table ${table} in ${database ?? "default DB"}` }],
    };
  }
);
```

## 这份笔记最该记住的结论

- `server.registerTool(...)` 的核心就是：`名字 + config + handler`
- `zod` 在这里最重要的用途是：定义参数、校验参数、生成可暴露的输入说明
- 你的项目现在已经切到了当前 SDK 更推荐的 `registerTool(...)`
- `zod` 负责“参数是否合法”，你的 SQL 相关函数负责“业务是否安全”
- 当你想写更适合教程和复用的 tool 时，像 `describe_table` 这种“单一意图、少量参数、明确返回”的设计会很舒服

## 相关笔记

- [[index-method-call-flow]]
- [[describe-table-tool-guide]]
