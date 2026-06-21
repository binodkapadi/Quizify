import os
import re
import json
import random  
from datetime import datetime, timezone
from urllib.parse import quote
from email.utils import parsedate_to_datetime
from dotenv import load_dotenv
from google import genai
import requests

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("❌ GOOGLE_API_KEY not found in .env file")

# Configure Gemini
client = genai.Client(api_key=GOOGLE_API_KEY)


def _strip_html(value: str) -> str:
    cleaned = re.sub(r"<[^>]+>", " ", value or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _extract_search_queries(notes: str, max_queries: int = 3) -> list[str]:
    cleaned_notes = (notes or "").strip()
    if not cleaned_notes:
        return []

    lines = [line.strip() for line in cleaned_notes.splitlines() if line.strip()]
    candidates = []
    for line in lines[:8]:
        short = re.sub(r"\s+", " ", line)
        if 6 <= len(short) <= 120:
            candidates.append(short)
        if len(candidates) >= max_queries:
            break

    if not candidates:
        snippet = cleaned_notes[:120]
        candidates.append(snippet)

    return candidates[:max_queries]


def _fetch_wikipedia_summary(query: str) -> list[dict]:
    results = []
    try:
        search_url = "https://en.wikipedia.org/w/api.php"
        search_res = requests.get(
            search_url,
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "utf8": 1,
                "format": "json",
            },
            timeout=8,
        )
        if search_res.status_code >= 400:
            return results
        items = (((search_res.json() or {}).get("query") or {}).get("search") or [])
        if not items:
            return results
        title = items[0].get("title")
        if not title:
            return results

        summary_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(title)}"
        summary_res = requests.get(summary_url, timeout=8)
        if summary_res.status_code >= 400:
            return results
        payload = summary_res.json() or {}
        extract = (payload.get("extract") or "").strip()
        page_url = ((payload.get("content_urls") or {}).get("desktop") or {}).get("page") or ""
        if extract:
            results.append(
                {
                    "source": "Wikipedia",
                    "title": title,
                    "snippet": extract[:500],
                    "url": page_url,
                }
            )
    except Exception:
        return results
    return results


def _fetch_duckduckgo_results(query: str, limit: int = 3) -> list[dict]:
    results = []
    try:
        response = requests.get(
            "https://lite.duckduckgo.com/lite/",
            params={"q": query},
            timeout=8,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        if response.status_code >= 400:
            return results
        html = response.text
        links = re.findall(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, flags=re.IGNORECASE | re.DOTALL)
        for href, title_html in links:
            title = _strip_html(title_html)
            if not href.startswith("http"):
                continue
            if not title or title.lower() in {"next page", "search", "duckduckgo"}:
                continue
            results.append(
                {
                    "source": "DuckDuckGo",
                    "title": title[:180],
                    "snippet": "",
                    "url": href,
                }
            )
            if len(results) >= limit:
                break
    except Exception:
        return results
    return results


def _fetch_google_news_rss(query: str, limit: int = 4) -> list[dict]:
    results = []
    try:
        rss_url = (
            "https://news.google.com/rss/search"
            f"?q={quote(query)}&hl=en-US&gl=US&ceid=US:en"
        )
        response = requests.get(rss_url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        if response.status_code >= 400:
            return results
        xml = response.text
        item_blocks = re.findall(r"<item>(.*?)</item>", xml, flags=re.DOTALL | re.IGNORECASE)
        for block in item_blocks[:limit]:
            title_match = re.search(r"<title><!\[CDATA\[(.*?)\]\]></title>", block, flags=re.DOTALL | re.IGNORECASE)
            if not title_match:
                title_match = re.search(r"<title>(.*?)</title>", block, flags=re.DOTALL | re.IGNORECASE)
            link_match = re.search(r"<link>(.*?)</link>", block, flags=re.DOTALL | re.IGNORECASE)
            pub_match = re.search(r"<pubDate>(.*?)</pubDate>", block, flags=re.DOTALL | re.IGNORECASE)
            source_match = re.search(r"<source[^>]*>(.*?)</source>", block, flags=re.DOTALL | re.IGNORECASE)

            title = _strip_html((title_match.group(1) if title_match else "").strip())
            url = (link_match.group(1) if link_match else "").strip()
            pub_date_raw = (pub_match.group(1) if pub_match else "").strip()
            source = _strip_html((source_match.group(1) if source_match else "").strip()) or "Google News"

            published_iso = ""
            if pub_date_raw:
                try:
                    published_iso = parsedate_to_datetime(pub_date_raw).astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
                except Exception:
                    published_iso = pub_date_raw

            if title and url:
                results.append(
                    {
                        "source": source,
                        "title": title[:220],
                        "snippet": f"Published: {published_iso}" if published_iso else "",
                        "url": url,
                    }
                )
    except Exception:
        return results
    return results


def _build_realtime_context(notes: str, max_items: int = 6) -> str:
    queries = _extract_search_queries(notes, max_queries=2)
    gathered = []
    for query in queries:
        # Prefer freshest signals first.
        gathered.extend(_fetch_google_news_rss(f"{query} latest", limit=4))
        gathered.extend(_fetch_google_news_rss(f"{query} current role", limit=3))
        gathered.extend(_fetch_wikipedia_summary(query))
        gathered.extend(_fetch_duckduckgo_results(f"{query} latest news", limit=2))
        if len(gathered) >= max_items:
            break

    if not gathered:
        return ""

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"Realtime context fetched at {stamp}:"]
    for idx, item in enumerate(gathered[:max_items], start=1):
        source = item.get("source", "Web")
        title = item.get("title", "").strip()
        snippet = item.get("snippet", "").strip()
        url = item.get("url", "").strip()
        lines.append(f"{idx}. [{source}] {title}")
        if snippet:
            lines.append(f"   Summary: {snippet}")
        if url:
            lines.append(f"   URL: {url}")
    return "\n".join(lines)


# added `seed` parameter for random variation and `language` selection
def generate_quiz_from_notes(
    notes: str,
    difficulty: str,
    model: str,
    num_questions: int = 5,
    seed: int = None,
    language: str = "English",
):
    """
    Uses Google Gemini models to generate MCQs from notes.
    Now supports custom number of questions.
    """

    seed_text = f"(Random context ID: {seed or random.randint(1, 100000)})"

    realtime_context = _build_realtime_context(notes)
    realtime_block = (
        f"\nLIVE CONTEXT (use this to prefer recent facts over older memory):\n{realtime_context}\n"
        if realtime_context
        else "\nLIVE CONTEXT: unavailable. Use only input notes.\n"
    )

    prompt = f"""
    You are a professional quiz generator.
    Based on the following notes, create exactly {num_questions} multiple-choice questions.
    Use this random context {seed_text} to ensure each generation is unique.

    Target quiz language: {language}.

    OUTPUT LANGUAGE RULES:
    - All questions, options, answers, and explanations must be written in {language}.
    - The input notes may be written in any language; always translate and respond in {language}.

    QUESTION FORMAT RULES:
    - Each question must include:
      - "question": the question text
      - "options": a list of 4 clear choices
      - "answer": the correct choice text (must exactly match one of the option strings)
      - "explanation": a short 2-3 line summary explaining why the correct answer is correct
    - Do NOT prefix options with letters or numbers such as "A)", "B.", "1)", "-", etc.
      Each option should only contain the option text itself.

    Difficulty: {difficulty}
    Notes: {notes}
    {realtime_block}

    RECENCY AND FACT-CHECKING RULES:
    - If LIVE CONTEXT provides newer facts than model memory, follow LIVE CONTEXT.
    - Give highest weight to LIVE CONTEXT entries with explicit publish dates from news sources.
    - Prefer objective facts from trusted sources in LIVE CONTEXT.
    - Avoid outdated claims when newer context is available.
    - If a fact is uncertain or conflicting, avoid making that fact the correct answer.

    Return only valid JSON in this format:
    [
      {{
        "question": "string",
        "options": ["option 1 text", "option 2 text", "option 3 text", "option 4 text"],
        "answer": "string",
        "explanation": "string"
      }}
    ]
    """


    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt
        )

        text = response.text.strip()
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            text = match.group(0)

        quiz = json.loads(text)

        # shuffle questions and options for randomness
        random.shuffle(quiz)
        for q in quiz:
            random.shuffle(q["options"])

        return quiz

    except json.JSONDecodeError:
        fixed = text.replace("'", '"')
        fixed = re.sub(r',\s*}', '}', fixed)
        fixed = re.sub(r',\s*]', ']', fixed)
        try:
            quiz = json.loads(fixed)
            random.shuffle(quiz)  
            for q in quiz:
                random.shuffle(q["options"])
            return quiz
        except Exception as inner_e:
            print("❌ JSON Fix Failed:", inner_e)
            return []

    except Exception as e:
        error_str = str(e)
        error_lower = error_str.lower()
        
        # Check if it's a quota/rate limit error (429)
        if "429" in error_str or "quota" in error_lower or "rate limit" in error_lower or "limit exceeded" in error_lower:
            print(f"❌ API limit for model '{model}' exceeds")
            print(f"   Error details: {error_str[:200]}")
            return []
        
        # Check if model doesn't exist or not supported (404)
        elif "404" in error_str or "not found" in error_lower or "not supported" in error_lower:
            print(f"❌ Model '{model}' not found or not supported for generateContent")
            print(f"   Error details: {error_str[:200]}")
            return []
        
        # Other errors
        else:
            print(f"❌ Gemini generation error for model '{model}': {error_str[:200]}")
            return []
