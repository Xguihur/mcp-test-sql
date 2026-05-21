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

这份笔记专门解释当前项目里 [index.js](/Users/xiaolongxia/Desktop/AI/db-readonly-mcp/index.js) 的 `server.tool(...)` 是怎么用的，它有哪些参数，以及 `z` 也就是 `zod` 这个校验库在这里扮演什么角色。

配合 [[index-method-call-flow]] 一起看会更完整。

> [!info] 这份说明基于当前项目实际安装版本
> - `@modelcontextprotocol/sdk`: `1.29.0`
> - `zod`: `3.25.76`
> - 当前项目示例使用的是 `server.tool(...)`
> - 但在这个 SDK 版本里，`tool(...)` 已经被标记为 `deprecated`，新代码更推荐用 `registerTool(...)`

## 先看你项目里的这段代码

```js
server.tool(
  "query",
  "Execute a single read-only SQL query against MySQL. Supports SELECT, SHOW, DESCRIBE, EXPLAIN, WITH.",
  {
    sql: z.string().min(1).describe("A single read-only SQL statement."),
    database: z
      .string()
      .min(1)
      .optional()
      .describe("Optional database name to override DB_NAME for this request."),
  },
  async ({ sql, database }) => {
    // 业务逻辑
  }
);
```

这 4 段分别代表：

| 位置 | 当前值 | 作用 |
| --- | --- | --- |
| 第 1 个参数 | `"query"` | tool 名字。MCP 客户端真正调用的就是这个名字。 |
| 第 2 个参数 | 一段 description | 给模型和客户端看的说明，帮助它判断什么时候该调用这个 tool。 |
| 第 3 个参数 | 一个由 `z` 定义的对象 | 参数 schema。既负责校验入参，也会被 SDK 转成 `inputSchema` 暴露给客户端。 |
| 第 4 个参数 | `async ({ sql, database }) => {}` | handler。当前 tool 被调用时，真正执行的业务逻辑。 |

## `server.tool(...)` 到底有哪些参数

> [!note]
> 当前项目用的是老一些但更短的写法：`server.tool(...)`。它依然能用，但在当前 SDK 里已经不再是首推 API。

根据你项目里安装的 SDK 类型定义，`tool(...)` 常见的几种用法是：

```ts
tool(name, cb)
tool(name, description, cb)
tool(name, paramsSchema, cb)
tool(name, description, paramsSchema, cb)
tool(name, paramsSchema, annotations, cb)
tool(name, description, paramsSchema, annotations, cb)
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

### 2. `description`

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

### 3. `paramsSchema`

类型：

- 在 `tool(...)` 这套旧写法里，通常是“一个对象”，对象的每个字段都是 `zod` schema。
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

### 4. `annotations`

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

你的当前项目没有传 `annotations`，但如果以后你把这个 tool 改得更语义化，可以这样写：

```js
server.tool(
  "query",
  "Execute a single read-only SQL query against MySQL.",
  {
    sql: z.string().min(1),
    database: z.string().optional(),
  },
  {
    title: "Read-only MySQL Query",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ sql, database }) => {
    // ...
  }
);
```

### 5. `cb` / `handler`

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

1. 明确告诉客户端：这个 tool 只接受 `sql` 和 `database`。
2. 明确告诉 SDK：哪些字段必填，哪些可选。
3. 在业务逻辑执行前，先挡掉明显不合法的输入。

换句话说，`zod` 负责“入口检查”，而你的这些 SQL 工具函数负责“业务安全检查”。

它们的分工可以理解为：

| 层次 | 负责什么 |
| --- | --- |
| `zod` schema | 检查参数结构和基本格式，比如是不是字符串、是不是可选、是不是空串。 |
| `normalizeSql / hasMultipleStatements / isReadonlySql` | 检查业务规则，比如是不是多语句、是不是只读 SQL。 |

## 当前 SDK 更推荐的写法：`registerTool(...)`

> [!warning]
> 在你当前安装的 `@modelcontextprotocol/sdk 1.29.0` 里，`tool(...)` 已经被标记为废弃接口。它还可以用，但新代码更推荐改成 `registerTool(...)`。

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

### 如果你只是看懂当前项目

先会看这条主线就够了：

```js
server.tool(name, description, paramsSchema, handler)
```

### 如果你准备继续扩这个项目

更建议你后面写成：

```js
server.registerTool(name, config, handler)
```

因为它：

- 语义更清楚
- 可扩展字段更集中
- 更符合当前 SDK 的推荐方向

## 放回你这个项目里，应该怎么理解

把 [index.js](/Users/xiaolongxia/Desktop/AI/db-readonly-mcp/index.js) 里的这段代码翻译成一句人话就是：

> 向 MCP 客户端注册一个叫 `query` 的工具。  
> 它接受一个必填字符串 `sql` 和一个可选字符串 `database`。  
> SDK 先用 `zod` 校验参数，再把校验后的值交给 handler。  
> handler 再继续做 SQL 清洗、只读判断、数据库执行和结果返回。

## 你后面扩展这个项目时的建议

> [!success]
> 如果你接下来要继续加 tool，可以直接照这个模式扩：
>
> 1. 先决定 tool 名字和 description  
> 2. 用 `zod` 把输入参数写清楚  
> 3. 在 handler 里做业务逻辑  
> 4. 能用 schema 挡掉的基础问题，尽量不要留到业务逻辑里再处理

比如：

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

- `server.tool(...)` 的核心就是：`名字 + 描述 + 参数 schema + handler`
- `zod` 在这里最重要的用途是：定义参数、校验参数、生成可暴露的输入说明
- 你的项目现在能正常工作，但从当前 SDK 版本来看，后续更推荐迁移到 `registerTool(...)`
- `zod` 负责“参数是否合法”，你的 SQL 相关函数负责“业务是否安全”

## 相关笔记

- [[index-method-call-flow]]
