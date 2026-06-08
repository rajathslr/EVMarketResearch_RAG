import requests

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0"})

queries = [
    ("chargepoint",       "ChargePoint EV charging"),
    ("evgo",              "EVgo fast charging"),
    ("blink",             "Blink charging"),
    ("plugshare",         "PlugShare EV"),
    ("electrify_america", "Electrify America"),
    ("flo",               "FLO EV charging"),
    ("evcs",              "EVCS charging"),
    ("shell_recharge",    "Shell Recharge"),
    ("tesla",             "Tesla"),
]

for name, query in queries:
    url = f"https://itunes.apple.com/search?term={requests.utils.quote(query)}&entity=software&country=us&limit=3"
    data = SESSION.get(url, timeout=10).json()
    print(f"\n--- {name} ---")
    for r in data.get("results", []):
        print(f"  {r['trackId']:<12} {r.get('averageUserRating','?')}*  {r['trackName']}")
