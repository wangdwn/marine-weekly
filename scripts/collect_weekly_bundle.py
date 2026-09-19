#!/usr/bin/env python3
"""Aggregate weekly source bundle for marine-weekly authors.

Pulls countable, sourceable facts from:
  - geo-ocean-bidding notices.json
  - marine-monitor funding.json
  - guangzhou-marine-enterprises activity.json (optional)

Does NOT invent KPIs. Writes data/reports/weekly_bundle_YYYY-MM-DD.json
and a markdown checklist for the next issue.
"""
from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TODAY = date.today().isoformat()


def load(path: Path):
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def parse_d(s: str) -> date | None:
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument(
        "--notices",
        type=Path,
        default=Path("/workspace/marine-reform/geo-ocean-bidding/docs/data/notices.json"),
    )
    ap.add_argument(
        "--funding",
        type=Path,
        default=Path("/workspace/marine-reform/marine-monitor/app/public/data/funding.json"),
    )
    ap.add_argument(
        "--activity",
        type=Path,
        default=Path("/workspace/marine-reform/guangzhou-marine-enterprises/activity.json"),
    )
    ap.add_argument("--out-dir", type=Path, default=ROOT / "data" / "reports")
    args = ap.parse_args()

    cutoff = date.today() - timedelta(days=args.days)
    bundle = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "window_days": args.days,
        "cutoff": cutoff.isoformat(),
        "positioning": "素材包仅汇总可溯源公开/仓内字段；写稿不得编造财务。",
        "notices": {"available": False, "recent": [], "gaps": []},
        "funding": {"available": False},
        "activity": {"available": False, "sample": []},
        "todo": [
            "核对每条 source_url 可打开",
            "无来源事件删除或标〔待核〕",
            "更新 marine-weekly data/issue-N.json + index.json",
            "同步 structure_judgment 底座更新日志",
        ],
    }

    notices = load(args.notices)
    if notices:
        rows = notices.get("notices") or []
        recent = []
        for n in rows:
            d = parse_d(str(n.get("publish_date") or ""))
            if d and d >= cutoff:
                recent.append(
                    {
                        "publish_date": n.get("publish_date"),
                        "title": n.get("title"),
                        "budget": n.get("budget"),
                        "win_amount": n.get("win_amount"),
                        "source_url": n.get("source_url") or "〔待核〕",
                        "region": n.get("region"),
                    }
                )
        missing = sum(1 for n in rows if not n.get("source_url"))
        bundle["notices"] = {
            "available": True,
            "source": str(args.notices),
            "total": len(rows),
            "recent_count": len(recent),
            "recent": recent,
            "missing_source_url": missing,
            "updated_at": notices.get("updated_at"),
        }

    funding = load(args.funding)
    if funding:
        items = funding.get("items") or []
        from collections import Counter

        bundle["funding"] = {
            "available": True,
            "source": str(args.funding),
            "updated": funding.get("updated"),
            "count": funding.get("count") or len(items),
            "status_dist": dict(Counter((i.get("status") or "〔待核〕") for i in items)),
            "note": "只读监测，不做申请入口",
        }

    activity = load(args.activity)
    if isinstance(activity, list):
        # activity timestamps are often MM-DD HH:MM without year
        bundle["activity"] = {
            "available": True,
            "source": str(args.activity),
            "total": len(activity),
            "sample": activity[:15],
            "gap": "条目时间为月-日，跨年需人工核对；内容多为搜索标题摘要。",
        }

    args.out_dir.mkdir(parents=True, exist_ok=True)
    out = args.out_dir / f"weekly_bundle_{TODAY}.json"
    with out.open("w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False, indent=2)
        f.write("\n")

    md = args.out_dir / f"weekly_bundle_{TODAY}.md"
    lines = [
        f"# 周报素材包 {TODAY}",
        "",
        f"窗口：近 {args.days} 日（cutoff {cutoff.isoformat()}）",
        "",
        "## 招标 notices",
        f"- 总量 {bundle['notices'].get('total', '〔待核〕')}；窗口内 {bundle['notices'].get('recent_count', 0)}",
        f"- 缺 source_url：{bundle['notices'].get('missing_source_url', '〔待核〕')}",
        "",
    ]
    for r in bundle["notices"].get("recent") or []:
        lines.append(f"- {r['publish_date']} {r['title']} | {r['source_url']}")
    lines += [
        "",
        "## 专项资金 funding",
        f"- updated={bundle['funding'].get('updated')} count={bundle['funding'].get('count')}",
        f"- status={bundle['funding'].get('status_dist')}",
        "",
        "## 待办",
        *[f"- [ ] {t}" for t in bundle["todo"]],
        "",
    ]
    md.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"wrote": str(out), "md": str(md), "recent_notices": bundle["notices"].get("recent_count")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
