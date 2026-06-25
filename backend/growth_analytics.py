from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from growth_common import db, require_growth_access

router = APIRouter(prefix="/api/growth/analytics")

MESSAGE_ACTIVITY_TYPES = ["email_sent", "dm_sent", "proposal_sent"]
MESSAGE_TYPE_LABELS = {"email_sent": "cold email", "dm_sent": "instagram dm", "proposal_sent": "proposal note"}

FUNNEL_STAGES = [
    ("new", "New Lead"),
    ("contacted", "Contacted"),
    ("qualified", "Qualified"),
    ("proposal", "Proposal"),
    ("negotiation", "Negotiation"),
    ("won", "Won"),
]

TEMP_COLOR = {"hot": "#ef4444", "warm": "#f97316", "cold": "#3b82f6"}


def _last_12_months() -> list[tuple[str, str]]:
    now = datetime.now(timezone.utc)
    months = []
    year, month = now.year, now.month
    for _ in range(12):
        months.append((f"{year:04d}-{month:02d}", datetime(year, month, 1).strftime("%b")))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return list(reversed(months))


@router.get("/overview")
async def analytics_overview(user: dict = Depends(require_growth_access)):
    leads = await db.growth_leads.find({}, {"_id": 0}).to_list(10000)
    activities = await db.growth_activities.find({}, {"_id": 0}).to_list(50000)

    by_stage = {}
    by_temperature = {"hot": 0, "warm": 0, "cold": 0}
    by_industry: dict = {}
    for lead in leads:
        stage = lead.get("stage", "new")
        by_stage[stage] = by_stage.get(stage, 0) + 1
        temp = lead.get("temperature") or "cold"
        by_temperature[temp] = by_temperature.get(temp, 0) + 1
        industry = (lead.get("niche") or "").strip()
        if industry:
            by_industry[industry] = by_industry.get(industry, 0) + 1

    message_activities = [a for a in activities if a.get("type") in MESSAGE_ACTIVITY_TYPES]
    messages_count = len(message_activities)
    won_count = by_stage.get("won", 0)

    months = _last_12_months()
    leads_by_month = {key: 0 for key, _ in months}
    messages_by_month = {key: 0 for key, _ in months}
    for lead in leads:
        key = (lead.get("created_at") or "")[:7]
        if key in leads_by_month:
            leads_by_month[key] += 1
    for a in message_activities:
        key = (a.get("created_at") or "")[:7]
        if key in messages_by_month:
            messages_by_month[key] += 1

    growth_12mo = [
        {"month": label, "leads": leads_by_month[key], "messages": messages_by_month[key]}
        for key, label in months
    ]

    pipeline_funnel = [{"stage": label, "count": by_stage.get(key, 0)} for key, label in FUNNEL_STAGES]

    temperature_distribution = [
        {"name": name.capitalize(), "value": count, "color": TEMP_COLOR[name]}
        for name, count in by_temperature.items()
        if count > 0
    ]

    top_industries = sorted(
        [{"industry": k, "count": v} for k, v in by_industry.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    type_counts: dict = {}
    for a in message_activities:
        t = a.get("type")
        type_counts[t] = type_counts.get(t, 0) + 1
    message_types = [
        {"type": MESSAGE_TYPE_LABELS.get(t, t.replace("_", " ")), "count": c}
        for t, c in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    return {
        "total_leads": len(leads),
        "hot_count": by_temperature.get("hot", 0),
        "warm_count": by_temperature.get("warm", 0),
        "cold_count": by_temperature.get("cold", 0),
        "messages_count": messages_count,
        "won_count": won_count,
        "growth_12mo": growth_12mo,
        "pipeline_funnel": pipeline_funnel,
        "temperature_distribution": temperature_distribution,
        "top_industries": top_industries,
        "message_types": message_types,
    }
