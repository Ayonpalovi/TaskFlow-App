def zero_performance():
    return {
        "score": 0,
        "completed_projects": 0,
        "on_time_deliveries": 0,
        "late_deliveries": 0,
        "revision_requests": 0,
        "client_reviews": 0,
        "average_rating": 0,
        "growth_stage": "New editor",
    }


def normalize_performance(user):
    perf = dict(user.get("performance") or {})
    defaults = zero_performance()

    for key, value in defaults.items():
        perf.setdefault(key, value)

    completed = int(perf.get("completed_projects") or 0)
    on_time = int(perf.get("on_time_deliveries") or 0)
    late = int(perf.get("late_deliveries") or 0)
    revisions = int(perf.get("revision_requests") or 0)
    reviews = int(perf.get("client_reviews") or 0)
    average_rating = float(perf.get("average_rating") or 0)
    xp = int(user.get("xp") or 0)

    calculated_score = 0
    if completed > 0 or xp > 0 or reviews > 0:
        calculated_score = round(
            (completed * 8)
            + (on_time * 5)
            - (late * 4)
            - (revisions * 1.5)
            + (average_rating * 6)
            + min(25, xp / 20)
        )
        calculated_score = min(100, max(0, calculated_score))

    perf["score"] = max(int(perf.get("score") or 0), calculated_score)
    perf["completed_projects"] = completed
    perf["on_time_deliveries"] = on_time
    perf["late_deliveries"] = late
    perf["revision_requests"] = revisions
    perf["client_reviews"] = reviews
    perf["average_rating"] = round(average_rating, 1)

    if perf["score"] >= 80:
        perf["growth_stage"] = "Top performer"
    elif perf["score"] >= 50:
        perf["growth_stage"] = "Growing fast"
    elif perf["score"] > 0:
        perf["growth_stage"] = "Improving"
    else:
        perf["growth_stage"] = "New editor"

    return perf


def install_performance_patch(server):
    original_scrub_user = server.scrub_user
    original_award_xp = server.award_xp

    def scrub_user_with_performance(user, viewer_role=None):
        output = original_scrub_user(user, viewer_role=viewer_role)
        if user.get("role") == "editor":
            output["performance"] = normalize_performance(user)
        return output

    async def award_xp_with_performance(editor_id, amount, reason):
        await original_award_xp(editor_id, amount, reason)
        user = await server.db.users.find_one({"id": editor_id}, {"_id": 0})
        if not user or user.get("role") != "editor":
            return
        perf = normalize_performance(user)
        await server.db.users.update_one({"id": editor_id}, {"$set": {"performance": perf}})

    async def initialize_editor_performance_defaults():
        result = await server.db.users.update_many(
            {"role": "editor", "performance": {"$exists": False}},
            {"$set": {"performance": zero_performance()}},
        )
        if result.modified_count:
            print(f"Initialized performance defaults for {result.modified_count} editors")

    server.scrub_user = scrub_user_with_performance
    server.award_xp = award_xp_with_performance
    server.app.add_event_handler("startup", initialize_editor_performance_defaults)
