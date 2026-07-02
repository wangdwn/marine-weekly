#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validate_issue.py — 《海洋经济与蓝色国土周报》每期数据校验器
用法: python3 validate_issue.py path/to/data/issue-N.json
零 ERROR 才可交付；WARNING 逐条人工判断。
若同目录存在 index.json，顺带校验目录一致性。
"""
import json
import re
import sys
from pathlib import Path

VALID_TABS = ["overview", "bluecarbon", "coast", "energy", "medicine",
              "portship", "tourism", "nansha", "suggest"]
VALID_BADGE_COLORS = {"red", "blue", "green", "gold", "purple", "gray"}
DATE_RANGE_RE = re.compile(r"^\d{1,2}月\d{1,2}日—\d{1,2}月\d{1,2}日$")
PUBLISH_RE = re.compile(r"^\d{4}年\d{1,2}月\d{1,2}日$")
MD_LEAK_RE = re.compile(r"\*\*|##|</?\w+[^>]*>")
EMPTY_TALK_RE = re.compile(r"^(建议)?(加大.{0,6}力度|积极对接|持续关注)[^，,。]{0,10}[。]?$")

errors, warnings = [], []


def err(msg):
    errors.append("ERROR   " + msg)


def warn(msg):
    warnings.append("WARNING " + msg)


def check_text(where, text, allow_infer=False):
    """通用文本纪律检查：Markdown 泄漏、[推断] 位置。"""
    if not isinstance(text, str):
        err(f"{where}: 应为字符串")
        return
    if MD_LEAK_RE.search(text):
        err(f"{where}: 检出 Markdown/HTML 标记（**、##、<>），必须纯文本")
    if "[推断]" in text and not allow_infer:
        err(f"{where}: [推断] 只能出现在 impact 字段开头")
    if allow_infer and not text.startswith("[推断]"):
        err(f"{where}: impact 必须以 [推断] 开头")


def sign_of_change(change):
    c = change.strip()
    if c.startswith(("+", "▲")) or "增" in c or "升" in c:
        return True
    if c.startswith(("-", "▼")) or "降" in c or "减" in c or "回落" in c:
        return False
    return None  # 无法判断方向（如"首批公示"），不校验


def check_kpi(where, k):
    for f in ("label", "value", "unit"):
        if f not in k:
            err(f"{where}: 缺少字段 {f}")
    if "isUp" in k and not isinstance(k["isUp"], bool):
        err(f"{where}: isUp 应为布尔值")
    if k.get("change") and isinstance(k.get("isUp"), bool):
        s = sign_of_change(str(k["change"]))
        if s is not None and s != k["isUp"]:
            err(f"{where}: change「{k['change']}」与 isUp={k['isUp']} 方向矛盾")


def check_item(where, it):
    for f in ("title", "content"):
        if not it.get(f):
            err(f"{where}: 缺少字段 {f}")
    check_text(where + ".title", it.get("title", ""))
    check_text(where + ".content", it.get("content", ""))
    if it.get("impact"):
        check_text(where + ".impact", it["impact"], allow_infer=True)
    if not it.get("source"):
        warn(f"{where}: 无 source，正式期建议必填")
    else:
        check_text(where + ".source", it["source"])
    badge = it.get("badge")
    if badge:
        if badge.get("color") not in VALID_BADGE_COLORS:
            err(f"{where}: badge.color「{badge.get('color')}」不合法，"
                f"应为 {sorted(VALID_BADGE_COLORS)}")
        if not badge.get("text"):
            warn(f"{where}: badge 缺少 text")


def check_suggest(where, s):
    for f in ("num", "title", "body"):
        if not s.get(f):
            err(f"{where}: 缺少字段 {f}")
    check_text(where + ".title", s.get("title", ""))
    check_text(where + ".body", s.get("body", ""))
    if not s.get("basis"):
        err(f"{where}: 缺少 basis（建议必须回指本期具体事实）")
    else:
        check_text(where + ".basis", s["basis"])
        if "本期" not in s["basis"]:
            warn(f"{where}: basis 未见「本期××板块」式回指，请确认依据来自本期内容")
    if EMPTY_TALK_RE.match(s.get("body", "").strip()):
        err(f"{where}: 建议正文为空话（加大力度/积极对接/持续关注类），不符合质量门槛")


def check_table(where, t):
    if not t.get("headers") or not t.get("rows"):
        err(f"{where}: 表格需同时有 headers 与 rows")
        return
    ncol = len(t["headers"])
    for i, row in enumerate(t["rows"]):
        if len(row) != ncol:
            err(f"{where}.rows[{i}]: 列数 {len(row)} 与表头 {ncol} 不一致")


def main(path):
    p = Path(path)
    if not p.exists():
        err(f"文件不存在: {p}")
        return report()
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        err(f"JSON 解析失败: {e}")
        return report()

    # ---- 顶层 ----
    for f in ("issue", "total", "year", "dateRange", "publishDate", "masthead", "tabs"):
        if f not in d:
            err(f"顶层缺少字段 {f}")
    m = re.match(r"issue-(\d+)\.json$", p.name)
    if m and d.get("issue") != int(m.group(1)):
        err(f"文件名期号 {m.group(1)} 与 issue={d.get('issue')} 不一致")
    if isinstance(d.get("issue"), int) and isinstance(d.get("total"), int) and d["total"] < d["issue"]:
        err(f"total={d['total']} 小于 issue={d['issue']}")
    if d.get("dateRange") and not DATE_RANGE_RE.match(d["dateRange"]):
        warn(f"dateRange「{d['dateRange']}」不符合「M月D日—M月D日」（注意全角破折号—）")
    if d.get("publishDate") and not PUBLISH_RE.match(d["publishDate"]):
        warn(f"publishDate「{d['publishDate']}」不符合「YYYY年M月D日」")
    mh = d.get("masthead") or {}
    if not mh.get("title") or not mh.get("org"):
        err("masthead 需包含 title 与 org")

    # ---- tabs ----
    tabs = d.get("tabs") or {}
    if not tabs:
        err("tabs 为空")
    if "overview" not in tabs:
        warn("本期无 overview 板块，请确认是否有意为之")
    for key, tab in tabs.items():
        if key not in VALID_TABS:
            err(f"tabs.{key}: 非法板块 key，合法值 {VALID_TABS}")
            continue
        w = f"tabs.{key}"
        has_content = any(tab.get(f) for f in
                          ("summary", "kpis", "tables", "briefings", "cards", "suggests"))
        if not has_content:
            err(f"{w}: 板块存在但无任何内容——无内容板块应直接省略 key")
        if tab.get("summary"):
            check_text(w + ".summary", tab["summary"])
        for i, k in enumerate(tab.get("kpis") or []):
            check_kpi(f"{w}.kpis[{i}]", k)
        for i, t in enumerate(tab.get("tables") or []):
            check_table(f"{w}.tables[{i}]", t)
        for i, b in enumerate(tab.get("briefings") or []):
            check_text(f"{w}.briefings[{i}].content", b.get("content", ""))
        for i, c in enumerate(tab.get("cards") or []):
            cw = f"{w}.cards[{i}]"
            if not c.get("title"):
                err(f"{cw}: 卡片缺少 title")
            st = c.get("shortTitle")
            if st and len(st) > 6:
                warn(f"{cw}: shortTitle「{st}」超过 6 字，侧边栏会截断")
            for j, it in enumerate(c.get("items") or []):
                check_item(f"{cw}.items[{j}]", it)
            for j, t in enumerate(c.get("tables") or []):
                check_table(f"{cw}.tables[{j}]", t)
        for i, s in enumerate(tab.get("suggests") or []):
            check_suggest(f"{w}.suggests[{i}]", s)

    # ---- 目录一致性（若同目录有 index.json）----
    idx_path = p.parent / "index.json"
    if idx_path.exists():
        try:
            idx = json.loads(idx_path.read_text(encoding="utf-8"))
            entry = next((e for e in idx if e.get("issue") == d.get("issue")), None)
            if not entry:
                err(f"index.json 中没有 issue={d.get('issue')} 的条目，记得追加")
            elif entry.get("dateRange") != d.get("dateRange"):
                err(f"index.json 的 dateRange「{entry.get('dateRange')}」"
                    f"与本期「{d.get('dateRange')}」不一致")
            nums = [e.get("issue") for e in idx]
            if nums != sorted(nums):
                err("index.json 期号未按升序排列")
        except Exception as e:
            warn(f"index.json 解析失败: {e}")
    else:
        warn("同目录未找到 index.json，跳过目录一致性校验")

    return report()


def report():
    for w in warnings:
        print(w)
    for e in errors:
        print(e)
    print(f"\n结果: {len(errors)} ERROR / {len(warnings)} WARNING")
    return 1 if errors else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
