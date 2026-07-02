---
name: marine-weekly
description: 生成、校验并归档《海洋经济与蓝色国土周报》（静态刊物引擎站点）的每期内容数据文件。凡用户提出"写周报 / 生成第N期 / 更新海洋周报 / 本周素材整理进周报 / marine weekly"，或给出一周涉海资讯要求产出结构化周报 JSON，或要求校验、修改往期数据、新增板块、部署周报站点时，务必使用本技能。即使用户只是粗略地说"该出周报了"或粘贴一堆新闻链接，也应触发。
---

# 海洋周报生成（marine-weekly）

本技能服务于一个"渲染壳 + data/ 目录"架构的静态周报站点：每期内容是一个独立 JSON 文件
（`data/issue-N.json`），目录清单在 `data/index.json`。前端引擎自带**政务语义高亮**
（信号句自动加粗、带单位数字自动高亮、`[推断]` 前缀渲染为独立标记），因此生成端只输出
纯文本，绝不输出 Markdown 标记。

## 工作流（按序执行）

### 第 1 步 · 确定期号与数据区间

读取站点 `data/index.json`（用户会提供站点目录或文件）。新期号 = 目录最后一期 + 1；
数据区间默认为上一期区间的次日起、连续 7 天（周一至周日）。若用户另有指定，以用户为准。
若拿不到 index.json，向用户确认期号与区间后再继续。

### 第 2 步 · 素材采集

若用户已提供素材（新闻、链接、内部信息），以用户素材为主体。素材不足或用户要求自动采集时，
按板块检索本数据区间内的公开信息（每个板块 1—3 次检索）：

| 板块 key | 检索方向示例 |
|---|---|
| bluecarbon | 蓝碳 CCER 方法学 / 红树林 盐沼 海草床 碳汇 / 碳市场 CEA 价格 |
| coast | 海岸带 地质灾害 / 岸线修复 / 台风 汛期 险情 广东 |
| energy | 广东 海上风电 竞配 并网 / 深远海 风电 场址 |
| medicine | 海洋生物医药 临床 / 海洋药物 政策 广东 |
| portship | 广州港 集装箱 吞吐量 / 造船 订单 交付 |
| tourism | 邮轮 南沙 / 游艇自由行 泊位 / 滨海旅游 |
| nansha | 南沙 海洋 政策 项目（本周） |

**区间纪律**：数据区间外的事件不得作为本期动态收录；确需引用的仅作背景，并在正文中明确标注时间。

### 第 3 步 · 写作

先读 `references/schema.md`（字段权威定义与完整示例），再读 `references/writing-style.md`
（政务简报体纪律 + 信号句式协同表）。两份文件是硬约束，不读不写。

核心规则速记（详见 references）：

- 每期 JSON 顶层：`issue / total / year / dateRange / publishDate / masthead / tabs`
- `tabs` 键限定为板块注册表内的 key；**本周无实质内容的板块直接省略**（前端自动隐藏），
  禁止用空话凑板块
- 事实写入 `content`，研判写入 `impact` 且以 `[推断] ` 开头；`source` 必填
- `suggests` 的每条 `basis` 必须引用本期其他板块的具体事实，形成"情报→行动"闭环
- KPI 的 `change` 文案与 `isUp` 布尔值方向必须一致
- 纯文本输出：不得出现 `**`、`#`、`<`、`>` 等标记字符

### 第 4 步 · 校验

运行 `scripts/validate_issue.py`：

```bash
python3 scripts/validate_issue.py <站点目录>/data/issue-N.json
```

必须零 ERROR 才能交付；WARNING 逐条人工判断。校验器检查结构完整性、板块 key 合法性、
isUp/change 一致性、Markdown 泄漏、[推断] 位置纪律、suggests 完整性等。

### 第 5 步 · 归档

1. 保存 `data/issue-N.json`
2. 在 `data/index.json` 末尾追加 `{ "issue": N, "title": "第N期", "dateRange": "…" }`
3. 再次运行校验器确认目录与新期文件一致（校验器会顺带检查同目录 index.json）
4. 告知用户：git push 后 Cloudflare Pages / GitHub Pages 自动发布，深链接为 `#issue-N`

## 常见变体任务

- **修改往期**：直接编辑对应 issue-N.json，改后必须重新过校验器。
- **新增板块**：需同时改前端 `assets/app.js` 的 `TAB_REGISTRY`（key/图标/长短标签）
  和 `references/schema.md` 的板块清单，二者保持同步。
- **从零部署站点**：整个站点目录（index.html + assets/ + data/）直接推送到
  Cloudflare Pages 或 GitHub Pages，无构建步骤；本地预览用 `python3 -m http.server`。
- **起一份新刊**（不同署名/板块的姊妹刊）：复制站点目录，改 masthead 与 TAB_REGISTRY，
  data/ 清空后从第 1 期开始。

## 红线（任何情况下不得违反）

1. 不得编造数据或来源。检索不到可靠来源的数字，降级为定性表述或舍弃该条。
2. 事实与研判必须分离：`content` 中不得夹带预测性、评价性结论；一切研判进 `impact`
   并以 `[推断]` 开头。
3. 工作建议必须具体到产业环节与动作，禁止"加大力度""积极对接""持续关注"类空话
   单独成条。
4. 本刊为内部参阅性质：页脚免责声明由前端固定输出，正文不得出现投资建议式表述。
