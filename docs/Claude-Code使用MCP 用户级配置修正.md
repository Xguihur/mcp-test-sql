---

## title: Claude Code MCP 用户级配置修正
aliases:
  - MCP 用户级配置问题
  - Claude Code MCP 配置修正
tags:
  - claude-code
  - mcp
  - obsidian-note
created: 2026-05-21

# Claude Code MCP 用户级配置修正

## 一开始的目的是什么

目标很简单：

- 把 `db-readonly-mcp` 接到 Claude Code
- 让 agent 能自动调用 `query` 和 `describe_table`

## 现在遇到什么问题

问题是：

- MCP 配置一开始写到了 `~/.claude/settings.json`
- 但 Claude Code 当前真正读取的用户级 MCP 配置位置是 `~/.claude.json`

结果就是：

- 文件里“看起来已经配了”
- 但当前会话的可用工具列表里没有真正加载到 `db-readonly`

## 要如何解决

把用户级 MCP 配置改到正确位置。

推荐方式：

```bash
claude mcp add -s user db-readonly \
  --env DB_HOST=localhost \
  --env DB_PORT=3306 \
  --env DB_USER=root \
  --env DB_PASSWORD=your_password \
  --env DB_NAME=your_default_database \
  -- node /xxx/db-readonly-mcp/index.js
```

然后：

- 重启 Claude Code session
- 再测试 tool 是否能触发

## 最终完整的解决方案示例

用户级配置最终应该体现在 `~/.claude.json` 中，类似：

```json
{
  "mcpServers": {
    "db-readonly": {
      "type": "stdio",
      "command": "node",
      "args": ["/xxx/db-readonly-mcp/index.js"],
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

测试时可以直接问：

- `请调用 MCP 工具 describe_table 查看 top_signature_list 表结构。`
- `top_signature_list 表有哪些字段？`

## 总结

这次问题不是 MCP server 代码错了，而是 Claude Code 的配置位置写错了。

记住这一条就够了：

- `~/.claude.json`：当前用户级 MCP 配置
- `.mcp.json`：当前项目级 MCP 配置
- 不要把 `mcpServers` 写到 `~/.claude/settings.json`

