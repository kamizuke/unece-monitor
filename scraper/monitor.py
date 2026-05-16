"""
UNECE WP.29 Regulations Monitor
Scrapes https://unece.org for new/changed regulation documents.
Writes changes to ../public/changes_log.json
"""

import json
import os
import re
import hashlib
from datetime import datetime, timezone
from pathlib import Path

BASE_URL = "https://unece.org/transport/vehicle-regulations-wp29/standards/addenda-1958-agreement-regulations-0-20"
ROOT = Path(__file__).parent.parent
STATE_FILE  = ROOT / "public" / "state.json"
LOG_FILE    = ROOT / "public" / "changes_log.json"
RUN_STATUS_FILE = ROOT / "public" / "run_status.json"
CONFIG_FILE = ROOT / "public" / "config.json"   # shared with the UI
EMAIL_CFG   = Path(__file__).parent / "config.json"  # email-only local config
PDF_DIR     = Path(__file__).parent / "pdfs"

DOC_TYPES = ["AMENDMENT", "CORRIGENDUM", "SUPPLEMENT", "REVISION", "ADDENDUM"]


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text())
    return default


def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "")


def doc_type_from_title(title: str) -> str:
    t = title.upper()
    for dt in DOC_TYPES:
        if dt in t:
            return dt
    return "DOCUMENT"


def hash_entry(title: str, url: str) -> str:
    return hashlib.md5(f"{title}|{url}".encode()).hexdigest()[:12]


def scrape_regulations(page, regs: list[int]) -> list[dict]:
    """Scrape the UNECE page and return found documents for the given reg numbers."""
    print(f"[monitor] Loading {BASE_URL} ...")
    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3000)

    entries = []
    links = page.query_selector_all("a[href]")

    for link in links:
        href = link.get_attribute("href") or ""
        text = (link.text_content() or "").strip()
        if not text or len(text) < 5:
            continue

        # Match "Regulation No. X" or "UN Regulation No. X" or similar
        for reg_num in regs:
            patterns = [
                rf"(?:UN\s+)?R\.?{reg_num}\b",
                rf"Regulation\s+No\.?\s*{reg_num}\b",
                rf"\bR{reg_num}\b",
            ]
            matched = any(re.search(p, text, re.IGNORECASE) for p in patterns)
            # Also check link text contains doc type keywords
            is_doc = any(dt.lower() in text.lower() for dt in DOC_TYPES)
            if matched and is_doc:
                full_url = href if href.startswith("http") else f"https://unece.org{href}"
                entries.append({
                    "reg": reg_num,
                    "title": text[:200],
                    "url": full_url,
                    "doc_type": doc_type_from_title(text),
                    "has_pdf": href.lower().endswith(".pdf"),
                })

    return entries


def detect_changes(found: list[dict], state: dict) -> tuple[list[dict], dict]:
    """Compare found documents against state, return new/changed items."""
    new_changes = []
    reg_state = state.get("regulations", {})
    now = utc_now()

    for entry in found:
        key = str(entry["reg"])
        if key not in reg_state:
            reg_state[key] = {"known_hashes": [], "known_entries": []}

        known = reg_state[key].get("known_hashes", [])
        known_entries = reg_state[key].get("known_entries", [])
        h = hash_entry(entry["title"], entry["url"])

        if h not in known:
            entry["id"] = f"c{h}"
            entry["change_type"] = "NUEVO_DOCUMENTO"
            entry["timestamp"] = now
            entry["has_prev"] = bool(known)
            entry["summary"] = f"Nuevo documento detectado: {entry['title'][:120]}"
            new_changes.append(entry)
            reg_state[key]["known_hashes"].append(h)
            known_entries.append({
                "hash": h,
                "title": entry["title"],
                "url": entry["url"],
                "doc_type": entry.get("doc_type", "DOCUMENT"),
                "first_seen": now,
                "last_seen": now,
            })
        else:
            for known_entry in known_entries:
                if known_entry.get("hash") == h:
                    known_entry["last_seen"] = now
                    break

        reg_state[key]["known_entries"] = known_entries[-50:]

    state["regulations"] = reg_state
    state["last_check"] = now
    return new_changes, state


def update_log(new_changes: list[dict]):
    existing = load_json(LOG_FILE, [])
    existing_ids = {e["id"] for e in existing}
    to_add = [c for c in new_changes if c["id"] not in existing_ids]
    if to_add:
        combined = to_add + existing
        # Keep last 200 entries
        save_json(LOG_FILE, combined[:200])
        print(f"[monitor] Added {len(to_add)} new entries to changes_log.json")
    else:
        print("[monitor] No new changes.")


def save_run_status(status: dict):
    save_json(RUN_STATUS_FILE, status)


def download_pdfs(changes: list[dict]):
    for change in changes:
        if not change.get("has_pdf") or not change.get("url", "").lower().endswith(".pdf"):
            continue
        reg_dir = PDF_DIR / f"R{change['reg']}"
        reg_dir.mkdir(parents=True, exist_ok=True)
        filename = change["url"].split("/")[-1]
        dest = reg_dir / filename
        if dest.exists():
            continue
        try:
            import requests as req_lib
            r = req_lib.get(change["url"], timeout=30, stream=True)
            r.raise_for_status()
            dest.write_bytes(r.content)
            print(f"[monitor] Downloaded {filename}")
        except Exception as e:
            print(f"[monitor] Failed to download {filename}: {e}")


def main():
    from playwright.sync_api import sync_playwright

    started_at = utc_now()
    config = load_json(CONFIG_FILE, {"regulations": [17, 48, 100, 155]})
    regs = config.get("regulations", [17, 48, 100, 155])
    if not regs:
        regs = [17, 48, 100, 155]
    state = load_json(STATE_FILE, {"last_check": None, "regulations": {}})

    print(f"[monitor] Monitoring regulations: {regs}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (compatible; UNECEMonitor/1.0; +https://github.com/unece-monitor)"
        )
        page = context.new_page()

        found = scrape_regulations(page, regs)
        print(f"[monitor] Found {len(found)} document links matching configured regulations")

        browser.close()

    new_changes, updated_state = detect_changes(found, state)
    print(f"[monitor] New changes: {len(new_changes)}")

    save_json(STATE_FILE, updated_state)
    update_log(new_changes)
    download_pdfs(new_changes)

    finished_at = utc_now()
    save_run_status({
        "status": "success",
        "started_at": started_at,
        "finished_at": finished_at,
        "last_success": finished_at,
        "source_url": BASE_URL,
        "regulations": regs,
        "documents_found": len(found),
        "new_changes": len(new_changes),
        "change_ids": [change["id"] for change in new_changes],
        "state_last_check": updated_state.get("last_check"),
    })

    print("[monitor] Done.")
    return len(new_changes)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        save_run_status({
            "status": "failed",
            "started_at": utc_now(),
            "finished_at": utc_now(),
            "error": str(exc),
            "source_url": BASE_URL,
        })
        raise
