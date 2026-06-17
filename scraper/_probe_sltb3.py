import requests, re
from bs4 import BeautifulSoup

BASE_URL = "https://srilankateaboard.lk/tea-statistics/"
AJAX_URL = "https://srilankateaboard.lk/wp-admin/admin-ajax.php"
HEADERS = {"User-Agent": "Mozilla/5.0 (SmartTeaAI/FYP research scraper)"}

session = requests.Session()
resp = session.get(BASE_URL, headers=HEADERS, timeout=15)
soup = BeautifulSoup(resp.text, "html.parser")
nonce = soup.find("input", {"name": "wpsecurity"})["value"]
print("Nonce:", nonce)

# Fetch the custom JS in full
js_urls = [s["src"] for s in soup.find_all("script", src=True) if "autoptimize" in s["src"]]
js_text = requests.get(js_urls[-1], headers=HEADERS, timeout=15).text

# Print all ajax blocks
for m in re.finditer(r"\$\.ajax\(.*?\}\)", js_text, re.DOTALL):
    print("\n=== AJAX CALL ===")
    print(m.group()[:1500])

# Also print all req_type values
print("\nAll req_type values:", re.findall(r"req_type['\"]?\s*:\s*['\"]([^'\"]+)['\"]", js_text))
print("All field names:",    re.findall(r"['\"](\w+)['\"]:", js_text[:3000]))

# Now try calling the AJAX endpoint — Step 1: get categories
print("\n=== STEP 1: Get categories ===")
r = session.post(AJAX_URL, data={
    "action": "ajaxteaprice",
    "req_type": "teaprice_init",
    "wpsecurity": nonce,
}, headers=HEADERS, timeout=15)
print("Status:", r.status_code)
print(r.text[:500])
