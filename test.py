"""
test_gdelt_history.py (v2 - handles rate limiting)

Quick diagnostic script - checks how far back GDELT's DOC 2.0 API
actually returns results for tea-market-related queries.

No API key needed. Run this locally (needs internet access) and
send me the printed output.
"""

import requests
import time

BASE_URL = "https://api.gdeltproject.org/api/v2/doc/doc"

TEST_WINDOWS = [
    ("2015-04-01", "2015-04-30", "2015 (dataset start)"),
    ("2018-01-01", "2018-01-31", "2018"),
    ("2019-06-01", "2019-06-30", "2019"),
    ("2020-04-01", "2020-04-30", "2020 (COVID period)"),
    ("2022-06-01", "2022-06-30", "2022 (crisis period)"),
    ("2024-01-01", "2024-01-31", "2024"),
]

QUERY = '"Colombo tea auction" OR "Ceylon tea price" OR "Sri Lanka tea export"'

DELAY_BETWEEN_REQUESTS = 15  # seconds - GDELT's free endpoint rate-limits aggressively
MAX_RETRIES = 3


def test_window(start_date, end_date, label):
    params = {
        "query": QUERY,
        "mode": "ArtList",
        "maxrecords": 10,
        "format": "json",
        "startdatetime": f"{start_date.replace('-', '')}000000",
        "enddatetime": f"{end_date.replace('-', '')}235959",
    }

    print(f"\n--- {label} ({start_date} to {end_date}) ---")

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(BASE_URL, params=params, timeout=20)

            if resp.status_code == 429:
                wait = 30 * attempt  # back off harder each retry
                print(f"  Rate limited (attempt {attempt}/{MAX_RETRIES}). "
                      f"Waiting {wait}s before retry...")
                time.sleep(wait)
                continue

            resp.raise_for_status()

            if not resp.text.strip():
                print("  Empty response body (likely still rate-limited).")
                return

            data = resp.json()
            articles = data.get("articles", [])
            print(f"Status: {resp.status_code} | Articles found: {len(articles)}")
            for a in articles[:3]:
                print(f"  - {a.get('seendate', '?')} | {a.get('title', '?')[:80]}")
            if not articles:
                print("  (no articles returned for this window - query may be too narrow, or no coverage)")
            return  # success, exit retry loop

        except requests.exceptions.RequestException as e:
            print(f"  ERROR: {e}")
            return
        except ValueError:
            print(f"  Non-JSON response (first 200 chars): {resp.text[:200]}")
            return

    print(f"  Failed after {MAX_RETRIES} attempts (still rate-limited).")


if __name__ == "__main__":
    print("Testing GDELT DOC 2.0 API historical coverage...")
    print(f"Query: {QUERY}")
    print(f"(Using {DELAY_BETWEEN_REQUESTS}s delay between requests to avoid rate limits - this will take a few minutes)\n")

    for start, end, label in TEST_WINDOWS:
        test_window(start, end, label)
        time.sleep(DELAY_BETWEEN_REQUESTS)

    print("\n\nDone. Send this full output back.")