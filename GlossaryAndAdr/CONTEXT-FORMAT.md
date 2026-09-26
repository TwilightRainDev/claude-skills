# CONTEXT.md 格式

## 结构

```md
# {上下文名称}

{一两句话描述此上下文是什么以及为什么存在。}

## 语言

**Order**：
{对该术语的一两句话描述}
_Avoid_：Purchase、transaction

**Invoice**：
发送给客户的付款请求，通常在交付后。
_Avoid_：Bill、payment request

**Customer**：
下单的个人或组织。
_Avoid_：Client、buyer、account
```

## 规则

- **要具有明确立场。** 当同一概念存在多个词时，选择最好的一个，并将其他词列在 `_Avoid_` 下。
- **保持定义紧凑。** 最多一两句话。定义它**是什么**，而不是它做什么。
- **只包含此项目上下文特有的术语。** 通用编程概念（超时、错误类型、工具模式）即使项目广泛使用，也不应放入此处。在添加术语之前，先问：这是此上下文特有的概念，还是一个通用编程概念？只有前者才属于这里。
- **当自然聚类出现时，将术语归到子标题下。** 如果所有术语都属于同一个连贯领域，则平铺列表也可以。

## 单上下文 vs 多上下文仓库

**单上下文（大多数仓库）：** 在仓库根目录下有一个 `CONTEXT.md`。

**多上下文：** 仓库根目录下的 `CONTEXT-MAP.md` 列出各上下文、它们的位置以及它们之间的关系：

```md
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md) — 接收并跟踪客户订单
- [Billing](./src/billing/CONTEXT.md) — 生成发票并处理付款
- [Fulfillment](./src/fulfillment/CONTEXT.md) — 管理仓库拣货和发货

## Relationships

- **Ordering → Fulfillment**：Ordering 发出 `OrderPlaced` 事件；Fulfillment 消费这些事件以开始拣货
- **Fulfillment → Billing**：Fulfillment 发出 `ShipmentDispatched` 事件；Billing 消费这些事件以生成发票
- **Ordering ↔ Billing**：共享类型 `CustomerId` 和 `Money`
```

该技能会推断应使用哪种结构：

- 如果 `CONTEXT-MAP.md` 存在，则读取它以查找上下文
- 如果仅存在根目录下的 `CONTEXT.md`，则为单上下文
- 如果两者都不存在，则在需要确定第一个术语时惰性地创建根 `CONTEXT.md`

当存在多个上下文时，推断当前主题与哪个上下文相关。如果不清楚，则询问。