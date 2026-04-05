"""
SmartCI Simulation Environment
Simulates a codebase + test suite for RL agent training.
"""
import random
from typing import List, Dict, Any

# ── Simulated codebase ──────────────────────────────────────────────────────
FILES = [
    "auth.js", "payment.js", "profile.js", "search.js",
    "user.js", "db.js", "utils.js", "api.js", "cache.js", "email.js",
]

# ── Simulated test suite ─────────────────────────────────────────────────────
TESTS = [
    "test_auth_login", "test_auth_logout", "test_auth_register",
    "test_payment_process", "test_payment_refund", "test_payment_validation",
    "test_profile_update", "test_profile_avatar",
    "test_search_query", "test_search_filter",
    "test_user_crud", "test_user_permissions",
    "test_db_connection", "test_db_queries",
    "test_utils_helpers", "test_cache_hit", "test_email_send",
]

# ── File → relevant tests mapping ────────────────────────────────────────────
FILE_TO_TEST_MAP: Dict[str, List[str]] = {
    "auth.js":    ["test_auth_login", "test_auth_logout", "test_auth_register"],
    "payment.js": ["test_payment_process", "test_payment_refund", "test_payment_validation"],
    "profile.js": ["test_profile_update", "test_profile_avatar", "test_user_crud"],
    "search.js":  ["test_search_query", "test_search_filter"],
    "user.js":    ["test_user_crud", "test_user_permissions"],
    "db.js":      ["test_db_connection", "test_db_queries"],
    "utils.js":   ["test_utils_helpers"],
    "api.js":     ["test_auth_login", "test_payment_process", "test_search_query"],
    "cache.js":   ["test_cache_hit", "test_db_queries"],
    "email.js":   ["test_email_send", "test_user_crud"],
}


def get_relevant_tests(changed_files: List[str]) -> List[str]:
    """Ground-truth relevant tests for a set of changed files."""
    relevant: set = set()
    for f in changed_files:
        relevant.update(FILE_TO_TEST_MAP.get(f, []))
    return list(relevant)


def simulate_commit(max_files: int = 3) -> List[str]:
    """Returns 1–max_files randomly changed files."""
    n = random.randint(1, max_files)
    return random.sample(FILES, n)


def simulate_test_run(
    selected_tests: List[str],
    changed_files: List[str],
    bug_probability: float = 0.35,
) -> Dict[str, Any]:
    """
    Runs selected tests against the simulated commit.
    Returns: bug_exists, bug_detected, failed_tests, missed_tests, time_taken.
    """
    relevant = get_relevant_tests(changed_files)
    bug_exists = random.random() < bug_probability

    failed_tests: List[str] = []
    bug_detected = False

    if bug_exists and relevant:
        bug_test = random.choice(relevant)
        if bug_test in selected_tests:
            failed_tests.append(bug_test)
            bug_detected = True

    missed_tests = [t for t in relevant if t not in selected_tests]
    time_taken = round(len(selected_tests) * random.uniform(1.0, 3.0), 2)

    return {
        "bug_exists": bug_exists,
        "bug_detected": bug_detected,
        "failed_tests": failed_tests,
        "missed_tests": missed_tests,
        "time_taken": time_taken,
        "total_tests": len(TESTS),
        "selected_count": len(selected_tests),
        "relevant_count": len(relevant),
    }
