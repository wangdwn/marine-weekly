# 海洋经济与蓝色国土周报 · 静态刊物引擎

零后端、零构建、零运维的按期归档周报站点。架构：**渲染壳 + data/ 目录**。

```
marine-weekly-site/
├── index.html            # 页面骨架（空壳容器）
├── assets/
│   ├── app.js            # 渲染引擎：数据驱动 tab、语义高亮、锚点导航、期数路由
│   └── style.css         # 红头刊头 + 海图等深线视觉
└── data/
    ├── index.json        # 期数目录（数组，每期一行）
    ├── issue-1.json      # 每期一个文件，按需懒加载
    └── issue-2.json
```

## 每周更新流程

1. 新增 `data/issue-N.json`（结构见任一现有期，或使用 marine-weekly 技能自动生成）
2. 在 `data/index.json` 末尾追加一行：`{ "issue": N, "title": "第N期", "dateRange": "…" }`
3. 把所有已有期的 `total` 无需回改——每期 JSON 里的 `total` 只影响该期页脚显示，建议新一期写当前总期数
4. git push，Cloudflare Pages / GitHub Pages 自动发布

深链接：`https://你的域名/#issue-3` 直达第3期。

## 本地预览

浏览器直接打开 file:// 会因 fetch 限制失败，用任一静态服务器：

```bash
cd marine-weekly-site && python3 -m http.server 8080
# 访问 http://localhost:8080
```

## 定制点

- **刊名与署名**：每期 JSON 的 `masthead.title` / `masthead.org`（会覆盖 index.html 里的默认值）
- **板块增删/排序/图标**：`assets/app.js` 顶部 `TAB_REGISTRY`。某期 JSON 里没有的板块自动隐藏
- **高亮规则**：`assets/app.js` 中 `STRONG_RULES`（信号句加粗）与 `NUM_RULE`（数字单位高亮）。
  生成端只输出纯文本，重点标注由前端确定性兜底
- **视觉**：`assets/style.css` 顶部 `:root` 变量（机关红、深海蓝、涨红跌绿等）

## 部署

**Cloudflare Pages**：仓库连接后 Build command 留空，Output directory 填 `/`（或本目录）。
**GitHub Pages**：仓库 Settings → Pages → 分支根目录即可。

## 配套

`marine-weekly` 技能封装了每期内容的生成流程（素材采集 → 按 schema 写作 → 校验 → 更新目录），
schema 与写作纪律的权威定义见技能包内 `references/`。
