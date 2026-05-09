"""
Email notifier for UNECE Monitor.
Sends alerts when new regulation changes are detected.
"""

import json
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

ROOT = Path(__file__).parent.parent
LOG_FILE = ROOT / "public" / "changes_log.json"
CONFIG_FILE = Path(__file__).parent / "config.json"


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text())
    return default


def build_html(changes: list[dict]) -> str:
    rows = ""
    for c in changes[:10]:
        rows += f"""
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;color:#005b9d">R{c['reg']}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">{c.get('doc_type','')}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">{c.get('title','')[:80]}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;color:#666">{c.get('summary','')[:100]}</td>
        </tr>"""

    return f"""
    <html><body style="font-family:Arial,sans-serif;color:#333;max-width:700px;margin:0 auto">
      <div style="background:#003d6b;color:white;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">🔔 UNECE Monitor — {len(changes)} cambio(s) detectado(s)</h1>
      </div>
      <div style="padding:20px;background:#f8f9fb;border:1px solid #e0e0e0;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:6px;overflow:hidden">
          <thead>
            <tr style="background:#005b9d;color:white">
              <th style="padding:10px;text-align:left">Reg.</th>
              <th style="padding:10px;text-align:left">Tipo</th>
              <th style="padding:10px;text-align:left">Título</th>
              <th style="padding:10px;text-align:left">Resumen</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
        <p style="color:#888;font-size:12px;margin-top:20px">
          Generado por UNECE Monitor · Datos de unece.org
        </p>
      </div>
    </body></html>"""


def send_notification(changes: list[dict], recipients: list[str]):
    username = os.environ.get("EMAIL_USERNAME")
    password = os.environ.get("EMAIL_PASSWORD")

    if not username or not password:
        print("[notifier] EMAIL_USERNAME or EMAIL_PASSWORD not set, skipping.")
        return

    if not recipients:
        print("[notifier] No recipients configured.")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"UNECE Monitor — {len(changes)} nuevo(s) cambio(s) en reglamentos WP.29"
    msg["From"] = username
    msg["To"] = ", ".join(recipients)

    html_content = build_html(changes)
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(username, password)
            server.sendmail(username, recipients, msg.as_string())
        print(f"[notifier] Email sent to {len(recipients)} recipient(s).")
    except Exception as e:
        print(f"[notifier] Failed to send email: {e}")


def main():
    config = load_json(CONFIG_FILE, {})
    email_cfg = config.get("email", {})

    if not email_cfg.get("enabled", False):
        print("[notifier] Email notifications disabled in config.")
        return

    recipients = email_cfg.get("to", [])
    log = load_json(LOG_FILE, [])

    # Only notify about changes from the last run (first entries are newest)
    recent = log[:5]

    if not recent:
        print("[notifier] No changes to notify.")
        return

    send_notification(recent, recipients)


if __name__ == "__main__":
    main()
