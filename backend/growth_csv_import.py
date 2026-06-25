import csv
import io

from growth_common import db, now_iso, new_id

FIELD_ALIASES = {
    "name": ["name", "full name", "fullname", "contact name", "contact", "lead name", "first name"],
    "company": ["company", "company name", "organization", "business", "brand", "account"],
    "email": ["email", "email address", "e-mail", "work email"],
    "phone": ["phone", "phone number", "mobile", "contact number", "telephone"],
    "instagram": ["instagram", "ig", "ig handle", "social", "social handle", "handle", "username"],
    "website": ["website", "url", "site", "web", "domain"],
    "niche": ["niche", "industry", "category", "vertical", "type"],
    "source": ["source", "channel", "lead source"],
    "value": ["value", "deal value", "amount", "budget", "deal size", "estimated value"],
    "notes": ["notes", "note", "comment", "comments", "description"],
}


def _normalize(header: str) -> str:
    return header.strip().lower().replace("_", " ").replace("-", " ")


def _map_headers(fieldnames: list[str]) -> dict:
    normalized = {_normalize(h): h for h in fieldnames if h}
    mapping = {}
    for field, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                mapping[field] = normalized[alias]
                break
    return mapping


def _parse_value(raw: str) -> float:
    if not raw:
        return 0.0
    cleaned = raw.replace("$", "").replace(",", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


async def import_csv(content: bytes, filename: str) -> dict:
    text = content.decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("Couldn't read any columns from that file.")

    mapping = _map_headers(reader.fieldnames)
    if "name" not in mapping and "company" not in mapping:
        raise ValueError(
            "Couldn't find a name or company column. Rename a column to 'name' (or 'company') and try again."
        )

    existing_emails = {
        lead["email"].lower()
        for lead in await db.growth_leads.find({"email": {"$ne": None}}, {"_id": 0, "email": 1}).to_list(20000)
        if lead.get("email")
    }

    created = duplicates = skipped = 0
    created_ids: list[str] = []

    for row in reader:
        def get(field: str) -> str:
            col = mapping.get(field)
            return (row.get(col) or "").strip() if col else ""

        name = get("name") or get("company")
        if not name:
            skipped += 1
            continue

        email = get("email").lower() or None
        if email and email in existing_emails:
            duplicates += 1
            continue

        doc = {
            "id": new_id(),
            "name": name,
            "company": get("company") or None,
            "email": email,
            "phone": get("phone") or None,
            "instagram": get("instagram") or None,
            "website": get("website") or None,
            "source": get("source") or "csv_import",
            "niche": get("niche") or None,
            "value": _parse_value(get("value")),
            "notes": get("notes") or None,
            "campaign_id": None,
            "tags": [],
            "stage": "new",
            "temperature": "cold",
            "created_at": now_iso(),
            "last_activity_at": now_iso(),
        }
        await db.growth_leads.insert_one(doc)
        await db.growth_activities.insert_one({
            "id": new_id(),
            "lead_id": doc["id"],
            "type": "lead_created",
            "content": f'Lead "{name}" was imported from {filename}',
            "created_at": now_iso(),
        })
        if email:
            existing_emails.add(email)
        created += 1
        created_ids.append(doc["id"])

    return {
        "created": created,
        "duplicates": duplicates,
        "skipped": skipped,
        "columns_detected": sorted(mapping.keys()),
        "created_ids": created_ids,
    }
