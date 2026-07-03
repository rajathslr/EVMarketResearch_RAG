"""
News scraper using direct publication RSS feeds.

Replaces Google News RSS (2022+ no longer exposes real article URLs).

Strategy:
  - EV-focused publications  -> all articles saved to _ev_general (ev_charging)
  - Prosumer-focused pubs    -> all articles saved to _prosumer_general (prosumer)
  - Mixed pubs (CleanTech..) -> routed by keyword
  - Any pub: app-specific keyword match -> also saved to that specific app file

Body extraction priority:
  1. content:encoded HTML in the RSS item -> trafilatura.extract  (fastest)
  2. requests.get(real_url) + trafilatura.extract                (fallback)
  3. '' — title + description used by run_pipeline.py

Usage:
    python pipeline/scrapers/news_rss.py
    python pipeline/scrapers/news_rss.py --app chargepoint evgo
    python pipeline/scrapers/news_rss.py --no-body

Output:
    data/raw/text/news/<app_name>/articles.json
    data/raw/text/news/_ev_general/articles.json
    data/raw/text/news/_prosumer_general/articles.json
"""
import argparse
import json
import logging
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

try:
    import trafilatura
    _TRAFILATURA_AVAILABLE = True
except ImportError:
    _TRAFILATURA_AVAILABLE = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Publication RSS feeds — with category tags
# ---------------------------------------------------------------------------

# (pub_name, feed_url, category)  category: "ev", "prosumer", "mixed"
FEEDS: list[tuple[str, str, str]] = [
    # EV Charging focused
    ("Electrek",          "https://electrek.co/feed/",                       "ev"),
    ("InsideEVs",         "https://insideevs.com/feed/",                     "ev"),
    ("ChargeDevs",        "https://chargedevs.com/feed/",                    "ev"),
    ("Electrive",         "https://www.electrive.com/feed/",                 "ev"),
    ("The Driven",        "https://thedriven.io/feed/",                      "ev"),
    ("Green Car Reports", "https://www.greencarreports.com/rss/news_rss.xml","ev"),
    # Prosumer / Home Energy focused
    ("pv magazine USA",     "https://pv-magazine-usa.com/feed/",              "prosumer"),
    ("Solar Power World",   "https://www.solarpowerworldonline.com/feed/",    "prosumer"),
    ("Energy Storage News", "https://www.energy-storage.news/feed/",          "prosumer"),
    ("Canary Media",        "https://www.canarymedia.com/rss.xml",            "prosumer"),
    ("Solar Builder",       "https://solarbuildermag.com/feed/",              "prosumer"),
    # Mixed — routed by keyword
    ("CleanTechnica", "https://cleantechnica.com/feed/", "mixed"),
    ("Ars Technica",  "https://feeds.arstechnica.com/arstechnica/index", "mixed"),
]

EV_KEYWORDS = [
    "ev charging", "electric vehicle charging", "charging station",
    "chargepoint", "evgo", "blink charging", "electrify america",
    "plugshare", "flo ev", "tesla supercharger", "shell recharge",
    "ev charger", "fast charging", "dcfc", "level 2 charging",
]

PROSUMER_KEYWORDS = [
    "home battery", "solar panel", "home energy", "energy storage",
    "powerwall", "enphase", "solaredge", "emporia", "sense energy",
    "generac", "span panel", "sunpower", "residential solar",
    "battery storage", "solar inverter", "smart panel", "grid-tied",
]

# Per-app keyword filters — articles matching these also saved per-app
APP_KEYWORDS: dict[str, list[str]] = {
    # EV Charging
    "chargepoint":       ["chargepoint"],
    "evgo":              ["evgo"],
    "blink":             ["blink charging", "blink charger", "blink ev"],
    "plugshare":         ["plugshare"],
    "electrify_america": ["electrify america"],
    "flo":               ["flo charging", "flo ev", "flo charger", "flo network"],
    "evcs":              ["evcs"],
    "shell_recharge":    ["shell recharge", "greenlots", "newmotion"],
    "tesla":             ["tesla supercharger", "supercharger network", "tesla charging network"],
    # Prosumer / Home Energy
    "tesla_powerwall":   ["powerwall", "tesla powerwall", "tesla energy storage"],
    "enphase":           ["enphase", "enlighten", "iq battery"],
    "solaredge":         ["solaredge", "solar edge", "mysolaredge"],
    "emporia":           ["emporia energy", "emporia vue", "emporia smart"],
    "sense":             ["sense energy", "sense home energy", "sense monitor"],
    "sunpower":          ["sunpower", "sun power solar"],
    "generac":           ["generac", "pwrview", "pwrcell", "pwr view"],
    "span":              ["span panel", "span smart", "span.io", "span home"],
}

# Per-app direct tag/publication feeds — sourced from publication tag pages
# These produce focused, app-specific articles without keyword guessing
APP_FEEDS: list[tuple[str, str, str]] = [
    # (pub_name, feed_url, app_name)
    # --- Tesla Powerwall ---
    ("Electrek/powerwall",          "https://electrek.co/tag/tesla-powerwall/feed/",        "tesla_powerwall"),
    ("Teslarati",                   "https://www.teslarati.com/feed/",                       "tesla_powerwall"),
    ("Tesla North",                 "https://teslanorth.com/feed/",                          "tesla_powerwall"),
    ("CleanTechnica/powerwall",     "https://cleantechnica.com/tag/powerwall/feed/",         "tesla_powerwall"),
    # --- Enphase ---
    ("Electrek/enphase",            "https://electrek.co/tag/enphase-energy/feed/",          "enphase"),
    ("CleanTechnica/enphase",       "https://cleantechnica.com/tag/enphase/feed/",           "enphase"),
    # --- SolarEdge ---
    ("Electrek/solaredge",          "https://electrek.co/tag/solaredge/feed/",               "solaredge"),
    # --- Span ---
    ("Electrek/span",               "https://electrek.co/tag/span/feed/",                    "span"),
    # --- Generac ---
    ("Electrek/generac",            "https://electrek.co/tag/generac/feed/",                 "generac"),
    ("CleanTechnica/generac",       "https://cleantechnica.com/tag/generac/feed/",           "generac"),
    # --- SunPower ---
    ("Electrek/sunpower",           "https://electrek.co/tag/sunpower/feed/",                "sunpower"),
    ("CleanTechnica/sunpower",      "https://cleantechnica.com/tag/sunpower/feed/",          "sunpower"),
    # --- ChargePoint ---
    ("Electrek/chargepoint",        "https://electrek.co/tag/chargepoint/feed/",             "chargepoint"),
    ("Electrive/chargepoint",       "https://www.electrive.com/tag/chargepoint/feed/",       "chargepoint"),
    ("CleanTechnica/chargepoint",   "https://cleantechnica.com/tag/chargepoint/feed/",       "chargepoint"),
    # --- EVgo ---
    ("Electrek/evgo",               "https://electrek.co/tag/evgo/feed/",                    "evgo"),
    ("Electrive/evgo",              "https://www.electrive.com/tag/evgo/feed/",              "evgo"),
    ("CleanTechnica/evgo",          "https://cleantechnica.com/tag/evgo/feed/",              "evgo"),
    ("EVChargingStations.com",      "https://evchargingstations.com/feed/",                  "evgo"),
    # --- Electrify America ---
    ("Electrek/electrify-america",  "https://electrek.co/tag/electrify-america/feed/",        "electrify_america"),
    ("Electrive/electrify-america", "https://www.electrive.com/tag/electrify-america/feed/",  "electrify_america"),
    ("CleanTechnica/ea",            "https://cleantechnica.com/tag/electrify-america/feed/",  "electrify_america"),
    # --- Shell Recharge ---
    ("Electrek/shell-recharge",     "https://electrek.co/tag/shell-recharge/feed/",           "shell_recharge"),
]

SLEEP_SECS      = 1.0
BODY_SLEEP_SECS = 0.5
BODY_TIMEOUT    = 12
BASE_DIR        = Path(__file__).parents[2] / "data"
TEXT_DIR        = BASE_DIR / "raw" / "text" / "news"

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
})

_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    return _HTML_TAG_RE.sub(" ", text or "").strip()


def _extract_from_html(html: str) -> str:
    """Extract readable text from HTML via trafilatura."""
    if not _TRAFILATURA_AVAILABLE or not html:
        return ""
    try:
        text = trafilatura.extract(
            html,
            include_comments=False,
            include_tables=True,
            no_fallback=False,
            favor_recall=True,
        )
        return (text or "").strip()
    except Exception:
        return ""


def _fetch_url_body(url: str) -> str:
    """Fetch article URL with requests, extract body with trafilatura.

    NOTE: trafilatura.fetch_url() is broken in v2.x — use requests.get()
    + trafilatura.extract() instead.
    """
    if not _TRAFILATURA_AVAILABLE or not url:
        return ""
    try:
        resp = SESSION.get(url, timeout=BODY_TIMEOUT)
        resp.raise_for_status()
        return _extract_from_html(resp.text)
    except Exception as exc:
        log.debug("Body fetch failed %s: %s", url, exc)
        return ""


# ---------------------------------------------------------------------------
# RSS / Atom feed parser
# ---------------------------------------------------------------------------

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=8))
def _fetch_raw(url: str) -> bytes:
    resp = SESSION.get(url, timeout=20)
    resp.raise_for_status()
    return resp.content


def parse_feed(xml_bytes: bytes, pub_name: str) -> list[dict]:
    """Parse RSS 2.0 or Atom bytes into article dicts with real article URLs.

    Each dict: title, link, description, body, published, source.
    body is extracted from content:encoded/Atom content when present.
    """
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        log.warning("  XML parse error for %s: %s", pub_name, exc)
        return []

    ns_content = "http://purl.org/rss/1.0/modules/content/"
    atom_ns    = "http://www.w3.org/2005/Atom"
    is_atom    = atom_ns in root.tag or root.tag == "feed"

    articles = []

    if is_atom:
        for entry in root.iter(f"{{{atom_ns}}}entry"):
            title = (entry.findtext(f"{{{atom_ns}}}title") or "").strip()
            link_el = entry.find(f"{{{atom_ns}}}link[@rel='alternate']")
            if link_el is None:
                link_el = entry.find(f"{{{atom_ns}}}link")
            link = (link_el.get("href", "") if link_el is not None else "").strip()
            if not title or not link:
                continue
            summary = _strip_html(entry.findtext(f"{{{atom_ns}}}summary") or "")
            content_el = entry.find(f"{{{atom_ns}}}content")
            content_html = (content_el.text or "") if content_el is not None else ""
            body = _extract_from_html(content_html) if content_html else ""
            pub = (entry.findtext(f"{{{atom_ns}}}published") or
                   entry.findtext(f"{{{atom_ns}}}updated") or "")
            articles.append({
                "title": title, "link": link,
                "description": summary, "body": body,
                "published": pub, "source": pub_name,
            })
    else:
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            link  = (item.findtext("link")  or "").strip()
            if not title or not link:
                continue
            desc = _strip_html(item.findtext("description") or "")
            encoded_el   = item.find(f"{{{ns_content}}}encoded")
            encoded_html = (encoded_el.text or "") if encoded_el is not None else ""
            body = _extract_from_html(encoded_html) if encoded_html else ""
            pub  = (item.findtext("pubDate") or "").strip()
            articles.append({
                "title": title, "link": link,
                "description": desc, "body": body,
                "published": pub, "source": pub_name,
            })

    return articles


# ---------------------------------------------------------------------------
# Fetch + categorise
# ---------------------------------------------------------------------------

def fetch_all_feeds() -> dict[str, list[dict]]:
    """Fetch all feeds. Returns dict keyed by feed category ('ev'/'prosumer'/'mixed')."""
    buckets: dict[str, list[dict]] = {"ev": [], "prosumer": [], "mixed": []}
    seen_links: set[str] = set()

    for pub_name, feed_url, category in FEEDS:
        try:
            raw   = _fetch_raw(feed_url)
            items = parse_feed(raw, pub_name)
            new, with_body = 0, 0
            for a in items:
                if a["link"] not in seen_links:
                    seen_links.add(a["link"])
                    buckets[category].append(a)
                    new += 1
                    if a.get("body"):
                        with_body += 1
            log.info("  %-25s [%-8s] -> %3d items | %3d new | %3d with body",
                     pub_name, category, len(items), new, with_body)
        except Exception as exc:
            log.warning("  %-25s FAILED: %s", pub_name, exc)
        time.sleep(SLEEP_SECS)

    return buckets


def enrich_bodies(articles: list[dict], label: str = "") -> list[dict]:
    """Fetch body for articles that didn't get it from the RSS content:encoded."""
    if not _TRAFILATURA_AVAILABLE:
        return articles
    need = [a for a in articles if not a.get("body")]
    if not need:
        return articles
    log.info("  %s Fetching bodies for %d articles...", label, len(need))
    fetched = 0
    for a in need:
        body = _fetch_url_body(a["link"])
        a["body"] = body
        if body:
            fetched += 1
        time.sleep(BODY_SLEEP_SECS)
    log.info("  %s URL body fetch: %d/%d succeeded", label, fetched, len(need))
    return articles


def _matches(article: dict, keywords: list[str]) -> bool:
    haystack = (article["title"] + " " + article["description"]).lower()
    return any(kw in haystack for kw in keywords)


# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------

def save_articles(app_name: str, articles: list[dict]) -> None:
    if not articles:
        return
    out_dir = TEXT_DIR / app_name
    out_dir.mkdir(parents=True, exist_ok=True)
    body_count = sum(1 for a in articles if a.get("body"))
    (out_dir / "articles.json").write_text(
        json.dumps({
            "app":        app_name,
            "count":      len(articles),
            "body_count": body_count,
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "articles":   articles,
        }, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    log.info("  Saved %-20s: %3d articles (%d with body)",
             app_name, len(articles), body_count)


# ---------------------------------------------------------------------------
# Per-app tag feed fetcher
# ---------------------------------------------------------------------------

def fetch_app_feeds(app_filter: list[str] | None = None, fetch_body: bool = True) -> None:
    """Fetch per-app tag/publication feeds and save directly to per-app article files."""
    seen: set[str] = set()
    buckets: dict[str, list[dict]] = {}

    log.info("Fetching %d per-app tag feeds...", len(APP_FEEDS))
    for pub_name, feed_url, app_name in APP_FEEDS:
        if app_filter and app_name not in app_filter:
            continue
        try:
            raw   = _fetch_raw(feed_url)
            items = parse_feed(raw, pub_name)
            new   = [a for a in items if a["link"] not in seen]
            for a in new:
                seen.add(a["link"])
            buckets.setdefault(app_name, []).extend(new)
            log.info("  %-35s -> %3d new items for %s", pub_name, len(new), app_name)
        except Exception as exc:
            log.warning("  %-35s FAILED: %s", pub_name, exc)
        time.sleep(SLEEP_SECS)

    if fetch_body:
        for app_name, articles in buckets.items():
            buckets[app_name] = enrich_bodies(articles, f"[{app_name}]")

    log.info("=== Saving per-app tag feed files ===")
    for app_name, articles in sorted(buckets.items()):
        save_articles(app_name, articles)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_scrape(app_filter: str | None = None, fetch_body: bool = True) -> None:
    """Scrape news from publication RSS feeds. `app_filter` restricts the
    per-app file output to one app name (matches run_pipeline.py's --app),
    otherwise every app gets its file. The _ev_general/_prosumer_general
    category buckets are always saved regardless of app_filter — they're
    what most retrieval actually hits. Callable directly (used by
    run_pipeline.py's on-demand refresh) or via CLI."""
    if fetch_body and not _TRAFILATURA_AVAILABLE:
        log.warning("trafilatura not installed — body fetch disabled. "
                    "Run: pip install trafilatura")
        fetch_body = False

    app_list = [app_filter] if app_filter else None

    log.info("Fetching %d publication RSS feeds...", len(FEEDS))
    buckets = fetch_all_feeds()

    ev_articles      = buckets["ev"]
    prosumer_articles = buckets["prosumer"]
    mixed_articles    = buckets["mixed"]

    # Route mixed-pub articles by keyword
    ev_from_mixed       = [a for a in mixed_articles if _matches(a, EV_KEYWORDS)]
    prosumer_from_mixed = [a for a in mixed_articles if _matches(a, PROSUMER_KEYWORDS)]

    all_ev_articles       = ev_articles + ev_from_mixed
    all_prosumer_articles = prosumer_articles + prosumer_from_mixed

    log.info("EV articles total: %d | Prosumer articles total: %d",
             len(all_ev_articles), len(all_prosumer_articles))

    # Enrich bodies
    if fetch_body:
        all_ev_articles       = enrich_bodies(all_ev_articles,       "[EV]")
        all_prosumer_articles = enrich_bodies(all_prosumer_articles, "[Prosumer]")

    # Save category buckets (all EV industry / all prosumer industry)
    log.info("=== Saving category buckets ===")
    save_articles("_ev_general",       all_ev_articles)
    save_articles("_prosumer_general", all_prosumer_articles)

    # Save per-app files for articles that specifically mention the app
    log.info("=== Saving per-app files ===")
    all_articles = all_ev_articles + all_prosumer_articles
    targets = {k: v for k, v in APP_KEYWORDS.items()
               if not app_list or k in app_list}
    for app_name, keywords in targets.items():
        matched = [a for a in all_articles if _matches(a, keywords)]
        if matched:
            log.info("  %s: %d articles", app_name, len(matched))
            save_articles(app_name, matched)
        else:
            log.info("  %s: 0 matches (category bucket covers it)", app_name)

    # Fetch dedicated per-app tag feeds (direct publication tag URLs)
    log.info("=== Fetching per-app tag feeds ===")
    fetch_app_feeds(app_filter=app_list, fetch_body=fetch_body)

    log.info("Done.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape EV/energy publication RSS feeds for news")
    parser.add_argument("--app", nargs="+", choices=list(APP_KEYWORDS.keys()),
                        help="Save specific app files only (category buckets always saved)")
    parser.add_argument("--no-body", action="store_true",
                        help="Skip body fetch (use RSS summaries only, fast)")
    args = parser.parse_args()

    fetch_body = not args.no_body
    if args.app:
        for name in args.app:
            run_scrape(app_filter=name, fetch_body=fetch_body)
    else:
        run_scrape(fetch_body=fetch_body)


if __name__ == "__main__":
    main()
