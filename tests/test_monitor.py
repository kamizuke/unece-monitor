import unittest

from scraper.monitor import detect_changes, hash_entry


class MonitorDetectionTests(unittest.TestCase):
    def test_detects_new_document_and_updates_state(self):
        found = [{
            "reg": 17,
            "title": "UN R17 Amendment 2",
            "url": "https://unece.org/doc/r17-amendment-2.pdf",
            "doc_type": "AMENDMENT",
            "has_pdf": True,
        }]
        state = {"last_check": None, "regulations": {}}

        changes, updated = detect_changes(found, state)

        self.assertEqual(len(changes), 1)
        self.assertEqual(changes[0]["change_type"], "NUEVO_DOCUMENTO")
        self.assertEqual(changes[0]["id"], f"c{hash_entry(found[0]['title'], found[0]['url'])}")
        self.assertEqual(updated["last_check"], changes[0]["timestamp"])
        self.assertEqual(len(updated["regulations"]["17"]["known_hashes"]), 1)
        self.assertEqual(updated["regulations"]["17"]["known_entries"][0]["last_seen"], changes[0]["timestamp"])

    def test_known_document_updates_last_seen_without_new_change(self):
        title = "UN R17 Amendment 2"
        url = "https://unece.org/doc/r17-amendment-2.pdf"
        known_hash = hash_entry(title, url)
        state = {
            "last_check": "2026-05-01T00:00:00",
            "regulations": {
                "17": {
                    "known_hashes": [known_hash],
                    "known_entries": [{
                        "hash": known_hash,
                        "title": title,
                        "url": url,
                        "doc_type": "AMENDMENT",
                        "first_seen": "2026-05-01T00:00:00",
                        "last_seen": "2026-05-01T00:00:00",
                    }],
                }
            },
        }
        found = [{
            "reg": 17,
            "title": title,
            "url": url,
            "doc_type": "AMENDMENT",
            "has_pdf": True,
        }]

        changes, updated = detect_changes(found, state)

        self.assertEqual(changes, [])
        self.assertNotEqual(updated["last_check"], "2026-05-01T00:00:00")
        self.assertEqual(len(updated["regulations"]["17"]["known_hashes"]), 1)
        self.assertEqual(updated["regulations"]["17"]["known_entries"][0]["first_seen"], "2026-05-01T00:00:00")
        self.assertEqual(updated["regulations"]["17"]["known_entries"][0]["last_seen"], updated["last_check"])


if __name__ == "__main__":
    unittest.main()
