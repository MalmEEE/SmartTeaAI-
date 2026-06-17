import requests, base64, re
from bs4 import BeautifulSoup

BASE_URL = "https://srilankateaboard.lk/tea-statistics/"
HEADERS = {"User-Agent": "Mozilla/5.0 (SmartTeaAI/FYP research scraper)"}

session = requests.Session()
resp = session.get(BASE_URL, headers=HEADERS, timeout=15)
soup = BeautifulSoup(resp.text, "html.parser")

# Decode all base64 inline scripts
for s in soup.find_all("script", src=True):
    src = s["src"]
    if src.startswith("data:text/javascript;base64,"):
        decoded = base64.b64decode(src.split(",", 1)[1]).decode("utf-8", errors="replace")
        print("=== DECODED INLINE SCRIPT ===")
        print(decoded)

# Get nonce from form
nonce = ""
for inp in soup.find_all("input", {"name": "wpsecurity"}):
    nonce = inp.get("value", "")
    print("Nonce:", nonce)

# Fetch the theme's custom JS (last autoptimize file — likely contains the AJAX call)
custom_js_urls = [s["src"] for s in soup.find_all("script", src=True)
                  if "autoptimize" in s["src"]]
print(f"\nFetching last autoptimize JS: {custom_js_urls[-1]}")
js_resp = session.get(custom_js_urls[-1], headers=HEADERS, timeout=15)
js_text = js_resp.text

# Look for the AJAX action name and field names
for pattern in [r"action['\"]?\s*[:=]\s*['\"]([^'\"]+)['\"]",
                r"wp_ajax_(\w+)",
                r"FormData|\.serialize\(\)",
                r"category|yearmonth|year_month|elevation|statistics"]:
    matches = re.findall(pattern, js_text, re.IGNORECASE)
    if matches:
        print(f"\nPattern '{pattern}' found: {matches[:10]}")

# Print a slice around any 'ajax' mention
idx = js_text.lower().find("ajax")
if idx != -1:
    print("\n--- Context around 'ajax' ---")
    print(js_text[max(0, idx-100):idx+500])
