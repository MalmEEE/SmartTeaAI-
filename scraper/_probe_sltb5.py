import requests, json
from bs4 import BeautifulSoup

BASE_URL = "https://srilankateaboard.lk/tea-statistics/"
AJAX_URL = "https://srilankateaboard.lk/wp-admin/admin-ajax.php"
HEADERS = {"User-Agent": "Mozilla/5.0 (SmartTeaAI/FYP research scraper)"}

session = requests.Session()
resp = session.get(BASE_URL, headers=HEADERS, timeout=15)
soup = BeautifulSoup(resp.text, "html.parser")
nonce = soup.find("input", {"name": "wpsecurity"})["value"]

# Print the entire form
form = soup.find("form", {"id": "teaprices-frm"})
if form:
    print("=== Form HTML ===")
    print(form.prettify()[:3000])
else:
    # Try finding any form
    for f in soup.find_all("form"):
        print("Form:", f.get("id"), f.get("class"))
        print(f.prettify()[:1000])

# Try to get categories with teaprice_init
print("\n=== Try teaprice_init ===")
r = session.post(AJAX_URL, data={
    "action": "ajaxteaprice",
    "req_type": "teaprice_init",
    "wpsecurity": nonce,
}, headers=HEADERS, timeout=15)
print(r.text[:500])

# Try common category IDs (1,2,3...)
print("\n=== Try category IDs 1-8 ===")
for i in range(1, 9):
    r = session.post(AJAX_URL, data={
        "action": "ajaxteaprice",
        "selected_category": str(i),
        "req_type": "teaprice_category",
        "wpsecurity": nonce,
    }, headers=HEADERS, timeout=10)
    d = r.json()
    opts = d.get("htmloptions", "")
    print(f"  category={i}: htmloptions length={len(opts)}", opts[:100] if opts else "")
