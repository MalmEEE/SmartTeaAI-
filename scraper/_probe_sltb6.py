import requests, json
from bs4 import BeautifulSoup

AJAX_URL = "https://srilankateaboard.lk/wp-admin/admin-ajax.php"
BASE_URL = "https://srilankateaboard.lk/tea-statistics/"
HEADERS = {"User-Agent": "Mozilla/5.0 (SmartTeaAI/FYP research scraper)"}

CATEGORY_IDS = {
    "sub_district_price":          "1982",
    "export":                      "1692",
    "reexport":                    "1789",
    "sales_volume_direct":         "2176",
    "production_volume_elevation": "2371",
    "production_volume_process":   "2595",
}

session = requests.Session()
resp = session.get(BASE_URL, headers=HEADERS, timeout=15)
soup = BeautifulSoup(resp.text, "html.parser")
nonce = soup.find("input", {"name": "wpsecurity"})["value"]
print("Nonce:", nonce)

for key, cat_id in CATEGORY_IDS.items():
    r1 = session.post(AJAX_URL, data={
        "action":            "ajaxteaprice",
        "selected_category": cat_id,
        "req_type":          "teaprice_category",
        "wpsecurity":        nonce,
    }, headers=HEADERS, timeout=15)
    d1 = r1.json()
    opts_html = d1.get("htmloptions", "")
    opts_soup = BeautifulSoup(opts_html, "html.parser")
    years = [(o.get("value"), o.get_text(strip=True))
             for o in opts_soup.find_all("option") if o.get("value")]
    print(f"\n{key} (id={cat_id}): {len(years)} year options")
    print("  Values:", years[:5])

    if years:
        # Fetch one table
        y_val = years[0][0]
        r2 = session.post(AJAX_URL, data={
            "action":            "ajaxteaprice",
            "selected_category": cat_id,
            "selected_year":     y_val,
            "req_type":          "teaprice_data",
            "wpsecurity":        nonce,
        }, headers=HEADERS, timeout=15)
        d2 = r2.json()
        html = d2.get("htmloptions", "")
        tsoup = BeautifulSoup(html, "html.parser")
        table = tsoup.find("table")
        if table:
            headers = [th.get_text(strip=True) for th in table.find_all("th")]
            rows = [[td.get_text(strip=True) for td in tr.find_all("td")]
                    for tr in table.find_all("tr")[1:4]]
            print(f"  Table headers: {headers}")
            print(f"  Sample rows: {rows}")
        else:
            print(f"  No table. HTML preview: {html[:200]}")
