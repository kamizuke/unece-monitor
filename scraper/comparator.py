"""
PDF Comparator — uses Claude API to analyze new UNECE documents.
Run after monitor.py when new PDFs are available.
"""

import json
import os
import sys
from pathlib import Path

import anthropic

ROOT = Path(__file__).parent.parent
LOG_FILE = ROOT / "public" / "changes_log.json"
PDF_DIR = Path(__file__).parent / "pdfs"


def load_log():
    if LOG_FILE.exists():
        return json.loads(LOG_FILE.read_text())
    return []


def save_log(data):
    LOG_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def analyze_change(client: anthropic.Anthropic, change: dict) -> str:
    prompt = f"""You are an expert in UNECE WP.29 vehicle regulation standards.
Analyze this regulatory change and provide a structured summary in Spanish:

Regulation: R{change['reg']}
Document type: {change.get('doc_type', 'N/A')}
Title: {change.get('title', 'N/A')}

Provide:
1. One-sentence executive summary
2. Key technical changes (2-3 bullet points)
3. Affected vehicle types/systems
4. Compliance deadline if known

Be concise and technical. Max 150 words."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("[comparator] ANTHROPIC_API_KEY not set, skipping AI analysis.")
        sys.exit(0)

    client = anthropic.Anthropic(api_key=api_key)
    log = load_log()

    # Find entries without AI summary (summary still contains raw scraper text)
    needs_analysis = [
        e for e in log
        if e.get("summary", "").startswith("Nuevo documento detectado:")
    ]

    if not needs_analysis:
        print("[comparator] No entries need AI analysis.")
        return

    print(f"[comparator] Analyzing {len(needs_analysis)} entries with Claude AI...")
    updated = 0

    for i, entry in enumerate(log):
        if not entry.get("summary", "").startswith("Nuevo documento detectado:"):
            continue
        try:
            ai_summary = analyze_change(client, entry)
            log[i]["summary"] = ai_summary
            updated += 1
            print(f"[comparator] Analyzed R{entry['reg']}: {entry['title'][:60]}...")
        except Exception as e:
            print(f"[comparator] Error analyzing {entry.get('id')}: {e}")

    save_log(log)
    print(f"[comparator] Updated {updated} entries with AI summaries.")


if __name__ == "__main__":
    main()
