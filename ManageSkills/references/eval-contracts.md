# 评测数据契约（eval-contracts）

评测工作流中各 JSON 文件的精确格式。脚本按这些契约读写。

## evals.json（第 2 步，测试提示保存）

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "用户的任务提示",
      "expected_output": "预期结果的描述",
      "files": []
    }
  ]
}
```

## eval_metadata.json（第 4 步，每次评估）

```json
{
  "eval_id": 0,
  "eval_name": "descriptive-name-here",
  "prompt": "用户的任务提示",
  "assertions": []
}
```

## timing.json（每次子智能体完成时立即记录）

```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

## feedback.json（第 5 步，用户评审）

```json
{
  "reviews": [
    {"run_id": "eval-0-with_skill", "feedback": "图表缺少轴标签", "timestamp": "..."},
  ],
  "status": "complete"
}
```

空反馈 等于 用户认为没问题。专注于对有具体投诉的评估进行改进。
