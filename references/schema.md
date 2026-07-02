# 每期数据文件 schema（权威定义）

文件名：`data/issue-N.json`（N 为阿拉伯数字期号）。编码 UTF-8，无 BOM。

## 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| issue | int | ✔ | 期号，与文件名中的 N 一致 |
| total | int | ✔ | 截至本期的总期数（通常 = issue） |
| year | string | ✔ | 年份，如 "2026" |
| dateRange | string | ✔ | 数据区间，格式 `6月22日—6月28日`（用全角破折号—） |
| publishDate | string | ✔ | 发布日期，格式 `2026年6月29日` |
| masthead | object | ✔ | `{ "title": 刊名, "org": 署名单位 }` |
| tabs | object | ✔ | 板块内容，key 见下方注册表 |

## 板块注册表（tabs 的合法 key，显示按此顺序）

`overview`（本周总览）、`bluecarbon`（蓝碳与生态）、`coast`（海岸带与地质安全）、
`energy`（海洋能源）、`medicine`（海洋生物医药）、`portship`（港航与船舶）、
`tourism`（滨海旅游）、`nansha`（南沙动态）、`suggest`（工作建议）。

无内容的板块**省略 key**，前端自动隐藏对应导航。`overview` 原则上每期必有。
新增板块需同步修改前端 `assets/app.js` 的 `TAB_REGISTRY` 并更新本表。

## 板块对象（tab）的字段

均为可选，按需组合；渲染顺序固定为 summary → kpis(+tables) → briefings → cards → suggests。

### summary（string）
本期概览段落，渲染为无编号卡片。适合"热点一：… 热点二：…"式导语。

### kpis（array）
存在时自动生成编号"一"的《核心数据》卡片。每项：

```json
{ "label": "指标名", "value": "98.6", "unit": "元/吨", "change": "+1.8%", "isUp": true }
```

- `value` 只放数字主体，单位放 `unit`
- `isUp` 决定涨跌配色（红涨绿跌）与箭头方向，必须与 `change` 的语义一致
- `change` 可省略（无环比时）

### tables（array，挂在有 kpis 的板块下或卡片内）

```json
{
  "title": "表标题（可选）",
  "headers": ["列1", "列2"],
  "rows": [["文本", "+2.1%"], ["文本", "-0.4%"]],
  "source": "数据来源（可选）"
}
```

单元格首字符为 `+`/`▲` 自动标红涨，`-`/`▼` 自动标绿跌。

### briefings（array）
无编号的文字简报卡：`{ "title": "…", "content": "…" }`。用于不需要条目结构的整段内容。

### cards（array）
带编号的条目卡。编号自动按声明顺序取"一二三…"（kpis 若存在已占用"一"）；
可用 `num` 字段强制指定。每张卡：

```json
{
  "num": "二",                  // 可选，一般省略让引擎自动编号
  "icon": "⚡",                 // 可选，默认 📋
  "title": "海上风电与新能源",
  "enTitle": "Offshore Energy", // 可选，英文小标
  "shortTitle": "风电动态",      // 可选，左侧锚点导航用的短标签（≤6字），省略则截取 title
  "items": [ … ],               // 条目数组，见下
  "tables": [ … ]               // 可选，卡内表格
}
```

### item（cards[].items 的元素）

```json
{
  "badge": { "color": "red", "text": "政策" },
  "title": "条目标题（一句话，含关键事实）",
  "content": "事实正文。只写可溯源事实，不夹带研判。",
  "impact": "[推断] 影响研判，必须以 [推断] 开头。",
  "source": "来源：机构/文件名，M月D日"
}
```

- `badge.color` 取值：`red`（政策/重大）、`blue`（动态/监测）、`green`(生态/项目)、
  `gold`（文旅/资金）、`purple`（科技/研发）、`gray`（其他）
- `impact`、`source` 可省略，但正式期建议 source 必填

### suggests（array）
存在时自动在板块末尾生成《工作建议》卡（编号取下一个空位）。
`suggest` 板块通常只放 suggests（可配 `suggestTitle` 自定义卡标题）。每条：

```json
{
  "num": "1",
  "title": "建议标题（动宾结构）",
  "body": "建议正文：招什么/做什么、为什么是现在、承接抓手是什么。",
  "basis": "本期××板块：引用的具体事实。"
}
```

`basis` 必须回指本期其他板块的具体事实，不得凭空。

## 完整最小示例

```json
{
  "issue": 3, "total": 3, "year": "2026",
  "dateRange": "6月29日—7月5日", "publishDate": "2026年7月6日",
  "masthead": { "title": "海洋经济与蓝色国土周报", "org": "广州市地质调查院（广州市海洋发展促进中心）" },
  "tabs": {
    "overview": {
      "summary": "热点一：……。建议……。",
      "kpis": [ { "label": "…", "value": "1", "unit": "件", "change": "+1", "isUp": true } ],
      "cards": [ {
        "icon": "🔭", "title": "本周要点速览", "enTitle": "Weekly Highlights", "shortTitle": "要点速览",
        "items": [ {
          "badge": { "color": "blue", "text": "动态" },
          "title": "…", "content": "…",
          "impact": "[推断] …", "source": "来源：…，7月2日"
        } ]
      } ],
      "suggests": [ { "num": "1", "title": "…", "body": "…", "basis": "本期总览板块：…" } ]
    }
  }
}
```

## 目录文件 data/index.json

```json
[
  { "issue": 1, "title": "第1期", "dateRange": "6月15日—6月21日" },
  { "issue": 2, "title": "第2期", "dateRange": "6月22日—6月28日" }
]
```

按期号升序，新一期追加在末尾。`dateRange` 与该期 JSON 内保持一字不差。
