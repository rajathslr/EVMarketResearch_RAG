"""
News scraper using Google News RSS feeds — no API key required.
Fetches recent news articles for each target EV charging app.

Usage:
    python pipeline/scrapers/news_rss.py
    python pipeline/scrapers/news_rss.py --app chargepoint evgo

Output:
    data/raw/text/news/<app_name>/articles.json
"""
import argparse
import json
import logging
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
APP_QUERIES = {
    # EV Charging
    "chargepoint":       ["ChargePoint EV charging app", "ChargePoint station"],
    "evgo":              ["EVgo fast charging", "EVgo EV charger"],
    "blink":             ["Blink Charging EV", "Blink charger network"],
    "plugshare":         ["PlugShare app EV", "PlugShare charging map"],
    "electrify_america": ["Electrify America charging", "Electrify America station"],
    "flo":               ["FLO EV charging network", "FLO charger"],
    "evcs":              ["EVCS electric vehicle charging"],
    "shell_recharge":    ["Shell Recharge EV", "Greenlots charging"],
    "tesla":             ["Tesla app charging", "Tesla supercharger network"],
    # Prosumer / Home Energy
    "tesla_powerwall":   ["Tesla Powerwall app", "Tesla Powerwall home battery"],
    "enphase":           ["Enphase Enlighten app", "Enphase home energy"],
    "solaredge":         ["SolarEdge mySolarEdge app", "SolarEdge monitoring"],
    "emporia":           ["Emporia Energy app", "Emporia smart home energy"],
    "sense":             ["Sense energy monitor app", "Sense home energy"],
    "sunpower":          ["SunPower solar app", "SunPower home solar"],
    "generac":           ["Generac PWRview app", "Generac home battery"],
    "span":              ["Span smart panel app", "Span home energy management"],
}

# General EV market queries for broader context
GENERAL_QUERIES = [
    "EV charging app review 2024",
    "electric vehicle charging network comparison",
    "EV charging station problems complaints",
]

SLEEP_SECS = 1.5
BASE_DIR   = Path(__file__).parents[2] / "data"
TEXT_DIR   = BASE_DIR / "raw" / "text" / "news"

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)",
    "Accept":     "application/rss+xml, application/xml, text/xml",
})


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=8))
def fetch_rss(query: str) -> list[dict]:
    url = f"https://news.google.com/rss/search?q={quote(query)}&hl=en-US&gl=US&ceid=US:en"
    resp = SESSION.get(url, timeout=15)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    ns   = {"dc": "http://purl.org/dc/elements/1.1/"}
    articles = []

    for item in root.findall(".//item"):
        title   = item.findtext("title", "").strip()
        link    = item.findtext("link", "").strip()
        desc    = item.findtext("description", "").strip()
        pub     = item.findtext("pubDate", "").strip()
        source  = item.findtext("source", "").strip()

        # Strip HTML tags from description
        import re
        desc = re.sub(r"<[^>]+>", " ", desc).strip()

        if not title:
            continue

        articles.append({
            "title":       title,
            "link":        link,
            "description": desc,
            "source":      source,
            "published":   pub,
            "query":       query,
        })

    return articles


def scrape_app(name: str, queries: list[str]) -> None:
    log.info("=== Scraping news for: %s ===", name)
    out_dir = TEXT_DIR / name
    out_dir.mkdir(parents=True, exist_ok=True)

    seen_links  = set()
    all_articles = []

    for query in queries:
        try:
            articles = fetch_rss(query)
            new = [a for a in articles if a["link"] not in seen_links]
            seen_links.update(a["link"] for a in new)
            all_articles.extend(new)
            log.info("  '%s' -> %d new articles (total: %d)", query, len(new), len(all_articles))
        except Exception as exc:
            log.warning("  '%s' failed: %s", query, exc)
        time.sleep(SLEEP_SECS)

    out_path = out_dir / "articles.json"
    out_path.write_text(
        json.dumps({
            "app":      name,
            "count":    len(all_articles),
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "articles": all_articles,
        }, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    log.info("  Saved %d articles -> %s", len(all_articles), out_path)


def scrape_general() -> None:
    log.info("=== Scraping general EV market news ===")
    out_dir = TEXT_DIR / "_general"
    out_dir.mkdir(parents=True, exist_ok=True)

    seen_links   = set()
    all_articles = []

    for query in GENERAL_QUERIES:
        try:
            articles = fetch_rss(query)
            new = [a for a in articles if a["link"] not in seen_links]
            seen_links.update(a["link"] for a in new)
            all_articles.extend(new)
            log.info("  '%s' -> %d articles", query, len(new))
        except Exception as exc:
            log.warning("  '%s' failed: %s", query, exc)
        time.sleep(SLEEP_SECS)

    out_path = out_dir / "articles.json"
    out_path.write_text(
        json.dumps({
            "app":        "_general",
            "count":      len(all_articles),
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "articles":   all_articles,
        }, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    log.info("  Saved %d general articles", len(all_articles))


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape Google News RSS for EV charging apps")
    parser.add_argument("--app", nargs="+", choices=list(APP_QUERIES.keys()),
                        help="Scrape specific apps only (default: all)")
    args = parser.parse_args()

    targets = {k: v for k, v in APP_QUERIES.items()
               if not args.app or k in args.app}

    scrape_general()

    for name, queries in targets.items():
        try:
            scrape_app(name, queries)
        except Exception as exc:
            log.error("Unexpected error scraping %s: %s", name, exc)

    log.info("Done.")


if __name__ == "__main__":
    main()
