import requests, json, re
from bs4 import BeautifulSoup

BASE_URL = "https://srilankateaboard.lk/tea-statistics/"
AJAX_URL = "https://srilankateaboard.lk/wp-admin/admin-ajax.php"
HEADERS = {"User-Agent": "Mozilla/5.0 (SmartTeaAI/FYP research scraper)"}

session = requests.Session()
resp = session.get(BASE_URL, headers=HEADERS, timeout=15)
soup = BeautifulSoup(resp.text, "html.parser")
nonce = soup.find("input", {"name": "wpsecurity"})["value"]
print("Nonce:", nonce)

# Try with first real category — "SUB DISTRICT PRICE"
category = "SUB DISTRICT PRICE"

print(f"\n=== Step 1: Get year options for '{category}' ===")
r1 = session.post(AJAX_URL, data={
    "action":            "ajaxteaprice",
    "selected_category": category,
    "req_type":          "teaprice_category",
    "wpsecurity":        nonce,
}, headers=HEADERS, timeout=15)
print("Status:", r1.status_code)
print("Raw response:", r1.text[:1000])

try:
    d1 = r1.json()
    print("JSON:", json.dumps(d1, indent=2)[:800])
    # Parse the htmloptions to extract year values
    if d1.get("htmloptions"):
        opts_soup = BeautifulSoup(d1["htmloptions"], "html.parser")
        year_values = [(o.get("value"), o.get_text(strip=True))
                       for o in opts_soup.find_all("option") if o.get("value")]
        print("\nYear options:", year_values[:10])
        if year_values:
            selected_year = year_values[0][0]  # try the first year
            print(f"\n=== Step 2: Get table for year '{selected_year}' ===")
            r2 = session.post(AJAX_URL, data={
                "action":            "ajaxteaprice",
                "selected_category": category,
                "selected_year":     selected_year,
                "req_type":          "teaprice_data",
                "wpsecurity":        nonce,
            }, headers=HEADERS, timeout=15)
            print("Status:", r2.status_code)
            d2 = r2.json()
            print("JSON keys:", list(d2.keys()))
            html = d2.get("htmloptions", "")
            print("HTML length:", len(html))
            print("HTML preview:", html[:800])
            # Parse table
            tsoup = BeautifulSoup(html, "html.parser")
            table = tsoup.find("table")
            if table:
                headers = [th.get_text(strip=True) for th in table.find_all("th")]
                print("\nTable headers:", headers)
                rows = table.find_all("tr")[1:4]
                for row in rows:
                    print([td.get_text(strip=True) for td in row.find_all("td")])
except Exception as e:
    print("Error:", e)
