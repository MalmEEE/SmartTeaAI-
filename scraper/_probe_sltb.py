import requests
from bs4 import BeautifulSoup

BASE_URL = "https://srilankateaboard.lk/tea-statistics/"
HEADERS = {"User-Agent": "Mozilla/5.0 (SmartTeaAI/FYP research scraper)"}

session = requests.Session()
resp = session.get(BASE_URL, headers=HEADERS, timeout=15)
print("Status:", resp.status_code)
print("Content-Type:", resp.headers.get("Content-Type"))

soup = BeautifulSoup(resp.text, "html.parser")

forms = soup.find_all("form")
print(f"\nForms found: {len(forms)}")
for f in forms:
    print("  Action:", f.get("action"), "| Method:", f.get("method", "GET"))
    for inp in f.find_all(["input", "select"]):
        print("   ", inp.get("type", "select"), inp.get("name"), inp.get("value", ""))

tables = soup.find_all("table")
print(f"\nTables found: {len(tables)}")
if tables:
    print("First table headers:", [th.get_text(strip=True) for th in tables[0].find_all(["th"])][:6])

print("\n-- Inline scripts with relevant keywords --")
scripts = soup.find_all("script", src=False)
for s in scripts:
    t = s.get_text()
    if any(k in t.lower() for k in ["ajax", "fetch", "category", "yearmonth", "year_month", "statistics", "action"]):
        print(t[:1000])
        print("---")

print("\n-- External script srcs --")
for s in soup.find_all("script", src=True):
    print(" ", s["src"])
