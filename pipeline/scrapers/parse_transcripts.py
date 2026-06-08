"""
parse_transcripts.py

Parses AllYoutubeTranscripts.txt into per-app transcripts.json files.
Merges with existing files (deduplicates by video_id).
"""

import re
import json
import hashlib
import os
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
INPUT_FILE = Path(r"C:\Users\Admin\Downloads\AllYoutubeTranscripts.txt")
OUTPUT_BASE = Path(r"C:\EVMarketResearch\data\raw\text\youtube")
SCRAPED_AT = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

# ---------------------------------------------------------------------------
# App-name mapping rules (checked in order against the section title)
# ---------------------------------------------------------------------------
def classify_title(title: str) -> str | None:
    """
    Return app_name string or None (meaning SKIP).
    """
    t = title.lower()

    # Explicit skips
    if "not for apps" in t:
        return None
    if "pod point" in t or "pod-point" in t:
        return None
    # EVCS Tutorial playlist is handled separately (SKIP block)
    if "evcs tutorial" in t and ("playlist" in t or "entier" in t or "entire" in t):
        return None

    # Mappings
    if "chargepoint" in t or "charge point" in t or "charge-point" in t:
        return "chargepoint"
    if "evgo" in t or "ev go" in t or "ev-go" in t:
        return "evgo"
    if "electrify america" in t:
        return "electrify_america"
    if "plugshare" in t or "plug share" in t or "plug-share" in t:
        return "plugshare"
    if "shell recharge" in t or "shell-recharge" in t:
        return "shell_recharge"
    if "flo" in t:
        return "flo"
    if "evcs" in t:
        return "evcs"
    if "tesla" in t:
        return "tesla"
    if "blink" in t:
        return "blink"

    return None  # unknown / skip


# ---------------------------------------------------------------------------
# Timestamp / artifact cleaning
# ---------------------------------------------------------------------------
def clean_transcript(text: str) -> str:
    lines = text.splitlines()
    cleaned = []

    for line in lines:
        s = line.strip()

        # Skip empty lines (we'll re-join later)
        if not s:
            cleaned.append("")
            continue

        # Skip pure standalone timestamp lines: "00:00:01", "0:00", "16:34", "1:30:00"
        if re.match(r'^\d{1,2}:\d{2}(:\d{2})?$', s):
            continue

        # Skip "Status: ok" / "Status: no transcript button" lines
        if re.match(r'^Status:', s, re.IGNORECASE):
            continue

        # Skip lines that are just numbered playlist items like "01." / "32."
        if re.match(r'^\d{1,2}\.\s', s) and len(s) < 80:
            # Could be a real sentence — only skip if it looks like a playlist item title
            if re.match(r'^\d{1,2}\.\s+\w[\w\s\-:]+$', s) and len(s) < 60:
                continue

        # Skip chapter headers: "Chapter 1: Intro", "Chapter 1: ..."
        if re.match(r'^Chapter\s+\d+:', s, re.IGNORECASE):
            continue

        # Strip [Music], [Applause], [music], [applause] entirely
        s = re.sub(r'\[Music\]|\[music\]|\[Applause\]|\[applause\]|\[MUSIC\]|\[APPLAUSE\]', '', s).strip()
        if not s:
            continue

        # Remove bracketed timestamps at start: [0:00], [1:23], [12:34:56]
        s = re.sub(r'^\[\d{1,2}:\d{2}(:\d{2})?\]\s*', '', s).strip()
        if not s:
            continue

        # Remove verbose inline "N seconds" / "N minutes" / "N minutes, N seconds" timestamps
        # Patterns like: "0:1515 secondstext", "1:001 minutetext", "2:182 minutes, 18 secondstext"
        # Also: "0:00all right" style (timestamp glued to text)
        # IMPORTANT: put longer alternatives first (seconds before second, minutes before minute)
        # to avoid partial matches that leave a trailing 's'.
        s = re.sub(
            r'^\d{1,2}:\d{2}\s*\d*\s*(?:seconds|second|minutes|minute)(?:,\s*\d+\s*(?:seconds|second))?\s*',
            '', s
        ).strip()

        # Also handle "0:00all right" (no space between timestamp and text), and plain "0:00"
        s = re.sub(r'^\d{1,2}:\d{2}\s*', '', s).strip()

        if not s:
            continue

        # Remove remaining [NN:NN] timestamps anywhere in the line (YouTube sidebar noise)
        # These show up as: [6:44] Ravi Kishan's UNEXPECTED...  → skip whole line if it looks like YT sidebar
        # Heuristic: if line starts with a bracketed timestamp after stripping and the rest looks like
        # a YouTube video title (with view counts / years), skip the whole line
        if re.match(r'^\[\d{1,3}:\d{2}(:\d{2})?\]', s):
            # Check if it looks like YouTube sidebar content (has "views" or "watching" or year pattern)
            if re.search(r'\d+[KMB]?\s+views|watching|\d{1,2}\s+(hours?|days?|weeks?|months?|years?)\s+ago', s):
                continue
            # Otherwise strip the timestamp and keep
            s = re.sub(r'^\[\d{1,3}:\d{2}(:\d{2})?\]\s*', '', s).strip()

        # Remove "N second" / "N minute" style duration prefixes that got left over
        s = re.sub(r'^\d+\s+(?:second|seconds|minute|minutes)(?:,\s*\d+\s*(?:second|seconds))?\s+', '', s).strip()

        if not s:
            continue

        cleaned.append(s)

    # Join lines, collapse multiple blank lines into one
    result = "\n".join(cleaned)
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result.strip()


# ---------------------------------------------------------------------------
# URL / video_id extraction
# ---------------------------------------------------------------------------
YT_URL_RE = re.compile(r'https?://(?:www\.)?youtube\.com/watch\?v=([\w\-]+)')

def extract_video_id(url: str) -> str:
    m = YT_URL_RE.search(url)
    if m:
        return m.group(1)
    return ""

def make_id_from_title(title: str) -> str:
    """Generate a stable hash-based ID when no URL is available."""
    return "hash_" + hashlib.md5(title.encode()).hexdigest()[:10]


# ---------------------------------------------------------------------------
# Section splitting
# ---------------------------------------------------------------------------
DIVIDER_RE = re.compile(r'^-{5,}$')

def split_sections(text: str) -> list[str]:
    """Split the full file by divider lines."""
    sections = []
    current_lines: list[str] = []
    for line in text.splitlines():
        if DIVIDER_RE.match(line.strip()):
            sections.append("\n".join(current_lines))
            current_lines = []
        else:
            current_lines.append(line)
    if current_lines:
        sections.append("\n".join(current_lines))
    return sections


# ---------------------------------------------------------------------------
# Parse a single section into (title, url, raw_transcript)
# ---------------------------------------------------------------------------
def is_timestamp_line(s: str) -> bool:
    """Return True if the line looks like a pure timestamp or starts with one."""
    return bool(re.match(r'^\d{1,2}:\d{2}', s) or re.match(r'^\[\d{1,2}:\d{2}', s))


def parse_section(section: str) -> tuple[str, str, str]:
    """
    Returns (title, url, raw_transcript_text).
    Title and URL may be empty strings.

    Header detection rules:
    - URL line: matches YouTube URL regex
    - Title line: a non-empty, non-URL, non-timestamp line that appears BEFORE
      the first timestamp line in the section.
    Once we've seen a timestamp line, we're in transcript content — stop header
    detection.
    """
    lines = section.splitlines()

    # Strip leading blank lines
    while lines and not lines[0].strip():
        lines.pop(0)

    if not lines:
        return ("", "", "")

    title = ""
    url = ""
    content_start = 0

    for idx, raw_line in enumerate(lines):
        s = raw_line.strip()
        if not s:
            continue

        # Once we hit a timestamp, header scanning is over
        if is_timestamp_line(s):
            content_start = idx
            break

        if YT_URL_RE.match(s):
            if not url:
                url = s
                content_start = idx + 1
        elif not title:
            title = s
            content_start = idx + 1
    else:
        # No timestamp found — all content is header or empty
        pass

    # Collect the transcript (everything from content_start onward)
    transcript_lines = lines[content_start:]
    raw_transcript = "\n".join(transcript_lines)

    return (title, url, raw_transcript)


# ---------------------------------------------------------------------------
# Load / save helpers
# ---------------------------------------------------------------------------
def load_existing(app_name: str) -> dict:
    path = OUTPUT_BASE / app_name / "transcripts.json"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {
        "app": app_name,
        "query": "manually added transcripts",
        "count": 0,
        "scraped_at": SCRAPED_AT,
        "transcripts": [],
    }


def save_app_data(app_name: str, data: dict):
    folder = OUTPUT_BASE / app_name
    folder.mkdir(parents=True, exist_ok=True)
    data["count"] = len(data["transcripts"])
    data["scraped_at"] = SCRAPED_AT
    path = folder / "transcripts.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    raw = INPUT_FILE.read_text(encoding="utf-8")
    sections = split_sections(raw)

    # Accumulate results per app_name
    app_data: dict[str, dict] = {}
    skipped: list[str] = []

    # Track if we're inside the EVCS playlist block to skip it entirely
    in_evcs_playlist = False

    for sec_idx, section in enumerate(sections):
        section = section.strip()
        if not section:
            continue

        title, url, raw_transcript = parse_section(section)

        # ----------------------------------------------------------------
        # EVCS playlist block detection — once we hit it, skip until end
        # ----------------------------------------------------------------
        if "evcs tutorial" in title.lower() and ("playlist" in title.lower() or "entier" in title.lower() or "entire" in title.lower()):
            in_evcs_playlist = True
            skipped.append(f"{title} (European hardware brand EVCS, entire playlist)")
            continue

        if in_evcs_playlist:
            # Check if this section looks like a new real section (has a recognisable app title)
            # The EVCS playlist ends at line 7381 (next section is Tesla)
            # The last entry in the EVCS block is numbered playlist items — they have no standalone title
            # So: if the section has a title that maps to a real app or skip, we're out
            test_app = classify_title(title) if title else None
            if title and (test_app is not None or "pod point" in title.lower()):
                in_evcs_playlist = False
                # Fall through to process this section
            else:
                # Still inside EVCS playlist block
                continue

        # ----------------------------------------------------------------
        # Classify the section
        # ----------------------------------------------------------------
        if not title and not url:
            # Section with no title and no URL  → Shell Recharge payment method video
            # (lines 5073-5129 per spec)
            app_name = "shell_recharge"
            title = "(Shell Recharge - add payment method)"
        elif not title and url:
            app_name = None
            skipped.append(f"(no title, url={url})")
        else:
            app_name = classify_title(title)

        if app_name is None:
            reason = ""
            tl = title.lower()
            if "not for apps" in tl:
                reason = "not an app review"
            elif "pod point" in tl or "pod-point" in tl:
                reason = "UK brand"
            elif "evcs tutorial" in tl:
                reason = "European hardware brand"
            else:
                reason = "no matching app"
            skipped.append(f"{title or '(no title)'} ({reason})")
            continue

        # ----------------------------------------------------------------
        # Clean the transcript
        # ----------------------------------------------------------------
        cleaned = clean_transcript(raw_transcript)

        # Skip sections that are effectively empty after cleaning
        if len(cleaned.strip()) < 50:
            skipped.append(f"{title} (too little content after cleaning)")
            continue

        # ----------------------------------------------------------------
        # Build transcript entry
        # ----------------------------------------------------------------
        video_id = extract_video_id(url) if url else ""
        if not video_id:
            video_id = make_id_from_title(title)

        entry = {
            "video_id": video_id,
            "title": title,
            "channel": "",
            "published_at": "",
            "description": "",
            "transcript": cleaned,
            "transcript_chars": len(cleaned),
        }

        # ----------------------------------------------------------------
        # Merge into app data (deduplicate by video_id)
        # ----------------------------------------------------------------
        if app_name not in app_data:
            app_data[app_name] = load_existing(app_name)

        existing_ids = {t["video_id"] for t in app_data[app_name]["transcripts"]}
        if video_id not in existing_ids:
            app_data[app_name]["transcripts"].append(entry)
        else:
            print(f"  [skip duplicate] {title} (video_id={video_id})")

    # ----------------------------------------------------------------
    # Save all app data
    # ----------------------------------------------------------------
    for app_name, data in app_data.items():
        save_app_data(app_name, data)

    # ----------------------------------------------------------------
    # Summary
    # ----------------------------------------------------------------
    print("\n=== SUMMARY ===")
    for app_name in sorted(app_data.keys()):
        count = len(app_data[app_name]["transcripts"])
        print(f"{app_name}: {count} transcript{'s' if count != 1 else ''} saved")

    for skip_msg in skipped:
        print(f"SKIPPED: {skip_msg}")


if __name__ == "__main__":
    main()
