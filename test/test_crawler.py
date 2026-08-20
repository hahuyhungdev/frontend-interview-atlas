import os
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import crawler


class SynthesizeKnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.original_data_dir = crawler.DATA_DIR
        self.temp_dir = tempfile.TemporaryDirectory()
        crawler.DATA_DIR = self.temp_dir.name

    def tearDown(self):
        crawler.DATA_DIR = self.original_data_dir
        self.temp_dir.cleanup()

    def test_only_includes_questions_explicitly_extracted_from_crawled_articles(self):
        article = {
            "title": "React state patterns",
            "original_url": "https://medium.com/example/react-state",
            "date": "2026-08-16",
            "company": "Example Co",
            "role": "Frontend Engineer",
            "salary": "N/A",
            "coding_questions": [
                {"question": "When should a reducer manage related state?"}
            ],
        }

        synthesis = crawler.synthesize_knowledge([article])

        self.assertEqual(len(synthesis["all_questions"]), 1)
        self.assertEqual(synthesis["all_questions"][0]["source_title"], article["title"])
        self.assertEqual(synthesis["all_questions"][0]["source_url"], article["original_url"])
        self.assertEqual(synthesis["all_questions"][0]["category"], "React")

    def test_fetch_url_has_a_network_timeout(self):
        response = MagicMock()
        response.read.return_value = b"article"
        context_manager = MagicMock()
        context_manager.__enter__.return_value = response

        with patch("crawler.urllib.request.urlopen", return_value=context_manager) as urlopen:
            self.assertEqual(crawler.fetch_url("https://medium.com/example/article"), b"article")

        self.assertEqual(urlopen.call_args.kwargs["timeout"], 15)


if __name__ == "__main__":
    unittest.main()
