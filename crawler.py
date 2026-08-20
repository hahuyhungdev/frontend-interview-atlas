import os
import re
import json
import urllib.request
import urllib.parse
from xml.etree import ElementTree
from bs4 import BeautifulSoup

# Define directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# User-Agent to avoid blocking
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# Predefined Seed URLs for older posts that might not be in the RSS feed
SEED_URLS = [
    "https://medium.com/frontend-army/amazon-frontend-engineer-interview-experience-2026-a81e237279aa",
    "https://medium.com/frontend-army/linkedin-senior-frontend-engineer-interview-experience-2026-9aa0658df97b",
    "https://medium.com/frontend-army/browserstack-frontend-developer-interview-experience-209020a79123",
    "https://medium.com/frontend-army/oracle-frontend-interview-experience-senior-frontend-engineer-da1a4b64a0cc",
    "https://medium.com/frontend-army/paypal-frontend-interview-experience-52-lpa-sse-ab08855e8cbf",
    "https://medium.com/frontend-army/jiohotstar-frontend-interview-experience-48-lpa-sde-2-865d1e62892d",
    "https://medium.com/frontend-army/tessell-frontend-interview-experience-52-lpa-senior-frontend-engineer-40bd61dd4259",
    "https://medium.com/frontend-army/makemytrip-mmt-frontend-interview-experience-sse-2-58c06c7a3e26",
    "https://medium.com/frontend-army/wayfair-frontend-interview-experience-sde-2-37acf597f8e2",
    "https://medium.com/frontend-army/okta-sde-2-frontend-interview-experience-45-lpa-7163980a4e0a",
    "https://medium.com/@gouravhammad477/my-deel-frontend-interview-experience-80k-frontend-engineer-react-js-cc5df7eb5963",
    "https://medium.com/@gouravhammad477/my-apple-frontend-interview-experience-frontend-engineer-hyderabad-a70dcf4d88fc",
    "https://medium.com/@gouravhammad477/my-apple-frontend-interview-experience-85-lpa-hyderabad-ecbd6cb92d29",
    "https://medium.com/frontend-army/creta-frontend-interview-experience-remote-role-0597a212f72a",
    "https://medium.com/frontend-army/ever-quint-frontend-interview-experience-screening-round-fa1987de58b9",
    "https://medium.com/frontend-army/triple-a-frontend-recruitment-exercise-442abd66ca4f",
    "https://medium.com/frontend-army/goibibo-frontend-interview-experience-sse-2-a8573358bff4",
    "https://medium.com/frontend-army/cult-fit-frontend-interview-experience-sde-2-d1d8834aae3c",
    "https://medium.com/frontend-army/okta-sde-2-frontend-interview-experience-sde-2-990014c22919",
    "https://medium.com/frontend-army/jio-hotstar-frontend-interview-experience-sde-2-5bf2e29d95b2",
    "https://medium.com/frontend-army/makemytrip-mmt-frontend-interview-experience-sse-2-676ab922c819",
    "https://medium.com/frontend-army/paytm-money-frontend-interview-experience-sse-2026-681c45f16c94",
    "https://medium.com/@gouravhammad477/oracle-frontend-interview-experience-2026-on-campus-8f198b47ba6e"
]

def fetch_url(url):
    """Fetch URL contents with spoofed headers."""
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.read()
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def parse_rss_feeds():
    """Fetch and parse RSS feeds to discover articles."""
    feeds = [
        "https://medium.com/feed/@gouravhammad477",
        "https://medium.com/feed/frontend-army",
        "https://medium.com/feed/frontend-army/tagged/interview-experience",
        "https://medium.com/feed/frontend-army/tagged/interview",
        "https://medium.com/feed/frontend-army/tagged/frontend",
        "https://medium.com/feed/frontend-army/tagged/react"
    ]
    discovered_urls = []
    
    for feed_url in feeds:
        print(f"Fetching RSS feed: {feed_url}...")
        xml_data = fetch_url(feed_url)
        if not xml_data:
            continue
        try:
            root = ElementTree.fromstring(xml_data)
            for item in root.findall('.//item'):
                # Extract link (remove query params)
                link = item.find('link').text
                if '?' in link:
                    link = link.split('?')[0]
                
                # Check creator if dc namespace is supported
                creator = ""
                creator_el = item.find('{http://purl.org/dc/elements/1.1/}creator')
                if creator_el is not None:
                    creator = creator_el.text
                
                # If the creator is Gourav Hammad or the feed is his personal profile feed
                if "gouravhammad477" in feed_url or (creator and "Gourav" in creator):
                    if link not in discovered_urls:
                        discovered_urls.append(link)
        except Exception as e:
            print(f"Error parsing feed {feed_url}: {e}")
            
    return discovered_urls

def html_to_markdown(soup_body):
    """Convert BeautifulSoup elements to clean Markdown."""
    markdown = []
    
    if not soup_body:
        return ""
    
    # Process elements recursively or sequentially
    for el in soup_body.descendants:
        if el.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            level = int(el.name[1])
            text = el.get_text().strip()
            # Avoid duplicating nested children content
            if text and not any(text in line for line in markdown[-3:] if line):
                markdown.append(f"\n\n{'#' * level} {text}\n")
        elif el.name == 'p':
            text = el.get_text().strip()
            if text and not any(text in line for line in markdown[-3:] if line):
                # Handle links inside paragraphs
                p_html = str(el)
                p_soup = BeautifulSoup(p_html, 'html.parser')
                for a in p_soup.find_all('a'):
                    if a.get('href'):
                        a.replace_with(f"[{a.get_text()}]({a.get('href')})")
                markdown.append(f"\n{p_soup.get_text().strip()}\n")
        elif el.name == 'li':
            text = el.get_text().strip()
            if text and not any(text in line for line in markdown[-3:] if line):
                markdown.append(f"\n* {text}")
        elif el.name == 'blockquote':
            text = el.get_text().strip()
            if text and not any(text in line for line in markdown[-3:] if line):
                markdown.append(f"\n> {text}\n")
        elif el.name == 'pre':
            code = el.get_text().strip()
            if code and not any(code in line for line in markdown[-3:] if line):
                markdown.append(f"\n```javascript\n{code}\n```\n")
        elif el.name == 'img':
            src = el.get('src')
            alt = el.get('alt', 'Image')
            if src and not any(src in line for line in markdown[-3:] if line):
                markdown.append(f"\n![{alt}]({src})\n")
                
    # Clean up excess newlines
    md_text = "".join(markdown)
    md_text = re.sub(r'\n{3,}', '\n\n', md_text)
    return md_text.strip()

def extract_meta_info(title, content, tags):
    """Perform basic heuristic parsing to categorize and extract metadata."""
    company = "General"
    salary = "N/A"
    role = "Frontend Engineer"
    
    # 1. Company Detection
    companies = ["Amazon", "LinkedIn", "BrowserStack", "Oracle", "PayPal", "JioHotstar", "Tessell", "MakeMyTrip", "Wayfair", "Okta", "Deel", "Apple"]
    for c in companies:
        if c.lower() in title.lower():
            company = c
            break
            
    # 2. Salary / Compensation Detection
    salary_match = re.search(r'(\d+\s*LPA|\d+\s*Lakh|\$\d+\s*[Kk]|\d+\s*[Kk]\s*USD)', title)
    if not salary_match:
        salary_match = re.search(r'(compensation|salary|package|offered|offer|lpa|lakhs)[^\n]{0,30}?(\d+\s*(?:LPA|Lakh|L|k|\$|USD))', content, re.IGNORECASE)
    if salary_match:
        salary = salary_match.group(0).strip()
        if ":" in salary:
            salary = salary.split(":")[-1].strip()
            
    # 3. Role Detection
    if "Senior" in title or "SSE" in title or "Senior" in content:
        role = "Senior Frontend Engineer"
    elif "SDE-2" in title or "SDE 2" in title or "SDE-2" in content:
        role = "Frontend Engineer II (SDE-2)"
    elif "SDE-1" in title or "SDE 1" in title or "SDE-1" in content:
        role = "Frontend Engineer I (SDE-1)"
        
    return {
        "company": company,
        "salary": salary,
        "role": role,
        "coding_questions": []
    }

def scrape_article(original_url):
    """Scrape the article using a multi-layer fallback strategy (Freedium CFD, Freedium Mirror CFD, Direct Googlebot)."""
    
    def parse_page(html):
        if not html:
            return None
        s = BeautifulSoup(html, 'html.parser')
        text = s.get_text()
        if "failed to render article" in text.lower() or "internal server error" in text.lower():
            return None
        title_el = s.find('h1')
        title = title_el.get_text().strip() if title_el else ""
        if not title:
            title = s.title.get_text().replace(" - Freedium", "").strip() if s.title else ""
        if not title or len(title) < 5 or "freedium" in title.lower() and len(title) < 15:
            return None
        return s, title

    # Layer 1: Freedium Official
    freedium_url = f"https://freedium.cfd/{original_url}"
    print(f"Scraping Layer 1 (Freedium CFD): {freedium_url}...")
    html_content = fetch_url(freedium_url)
    res = parse_page(html_content)
    
    # Layer 2: Freedium Mirror
    if not res:
        freedium_mirror_url = f"https://freedium-mirror.cfd/{original_url}"
        print(f"Scraping Layer 2 (Freedium Mirror): {freedium_mirror_url}...")
        html_content = fetch_url(freedium_mirror_url)
        res = parse_page(html_content)
        
    # Layer 3: Direct Medium Googlebot Spoof (Googlebot bypasses paywalls/Cloudflare)
    if not res:
        print(f"Scraping Layer 3 (Direct Medium with Googlebot spoofing): {original_url}...")
        googlebot_headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        }
        req = urllib.request.Request(original_url, headers=googlebot_headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                html_content = response.read()
                res = parse_page(html_content)
        except Exception as e:
            print(f"Direct Medium with Googlebot failed: {e}")
            
    # Layer 4: Direct Medium Chrome Headers
    if not res:
        print(f"Scraping Layer 4 (Direct Medium with Chrome headers): {original_url}...")
        req = urllib.request.Request(original_url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                html_content = response.read()
                res = parse_page(html_content)
        except Exception as e:
            print(f"Direct Medium with Chrome headers failed: {e}")
            
    if not res:
        print(f"All scraping layers failed for: {original_url}")
        return None
        
    soup, title = res
    author = "Gourav Hammad"
    
    # Extract Date
    date_el = soup.find('header')
    date_text = ""
    if date_el:
        p_date = date_el.find('p')
        if p_date:
            date_text = p_date.get_text().strip()
    if not date_text:
        time_el = soup.find('time')
        if time_el:
            date_text = time_el.get_text().strip()
            
    # Extract Main Content
    content_container = soup.find('article')
    if not content_container:
        content_container = soup.find(class_="prose")
        
    markdown_content = ""
    if content_container:
        markdown_content = html_to_markdown(content_container)
    else:
        markdown_content = soup.get_text()
        
    # Extract tags / categories
    tags = []
    for a in soup.find_all('a', href=True):
        if '/tag/' in a['href'] or '/category/' in a['href']:
            tag_name = a.get_text().strip()
            if tag_name and tag_name not in tags:
                tags.append(tag_name)
                
    meta = extract_meta_info(title, markdown_content, tags)
    
    return {
        "title": title,
        "author": author,
        "original_url": original_url,
        "freedium_url": f"https://freedium-mirror.cfd/{original_url}",
        "date": date_text,
        "content_markdown": markdown_content,
        "tags": tags,
        "company": meta["company"],
        "salary": meta["salary"],
        "role": meta["role"],
        "coding_questions": meta["coding_questions"]
    }

def categorize_question(q):
    """Categorize a technical question into a technology topic based on keyword matching."""
    q_lower = q.lower()
    if any(k in q_lower for k in ["bst", "binary search", "traversal", "matrix", "three sum", "3sum", "two pointer", "lru cache", "sorted array", "sorted binary", "triplet", "substring", "longest common", "binary tree", "complexity"]):
        return "Algorithms & Data Structures"
    if any(k in q_lower for k in ["react", "hook", "usecontext", "useeffect", "usestate", "component", "props", "virtual dom", "state management", "render", "context api"]):
        return "React"
    if any(k in q_lower for k in ["css", "html", "flexbox", "grid", "responsive", "style", "layout", "tooltip", "media query", "skeleton", "shimmer"]):
        return "CSS & HTML"
    if any(k in q_lower for k in ["javascript", "js", "promise", "closure", "event loop", "memoiz", "debounce", "throttle", "array.prototype", "groupby", "callback", "eventemitter", "observer pattern"]):
        return "JavaScript (Core)"
    if any(k in q_lower for k in ["system design", "architecture", "scalability", "autocomplete", "infinite scroll", "content publishing", "reddit-style comment", "nested comment"]):
        return "System Design & Architecture"
    return "General / Other"

# Curated high-fidelity database of questions & optimized code solutions
CURATED_QUESTIONS = [
    # --- REACT HUB: CONCEPTUAL QUESTIONS ---
    {
        "category": "React",
        "company": "General",
        "role": "React Concept",
        "question": "What is the Virtual DOM and how does it improve React performance?",
        "solution": "The Virtual DOM (VDOM) is an in-memory representation of the real DOM elements. When a component state changes, React first updates this VDOM representation. It then compares the new VDOM with the previous VDOM (a process called 'Diffing') to determine exactly which nodes in the real DOM need to be updated. Finally, it applies only these differences to the real DOM (a process called 'Reconciliation' or batching). This avoids expensive, direct DOM mutations, making updates fast.",
        "source_title": "Top 25 ReactJS Interview Questions"
    },
    {
        "category": "React",
        "company": "General",
        "role": "React Concept",
        "question": "How does React's Diffing/Reconciliation Algorithm work?",
        "solution": "React uses a heuristic O(N) diffing algorithm based on two main assumptions:\n1) Two elements of different types will produce different trees (React will tear down the old tree and build the new one from scratch).\n2) Keys are used to identify stable elements between renders, allowing React to match children across different renders. This allows React to update trees in linear time instead of general O(N^3) tree diffing.",
        "source_title": "Top 25 ReactJS Interview Questions"
    },
    {
        "category": "React",
        "company": "General",
        "role": "React Concept",
        "question": "What are React Portals and when should you use them?",
        "solution": "Portals provide a way to render children into a DOM node that exists outside the DOM hierarchy of the parent component.\n\nUsage:\n`ReactDOM.createPortal(child, container)`\n\nUse Cases: Modals, Dialogs, Tooltips, and Hovercards, where you want to break out of parent container style constraints like `overflow: hidden` or `z-index` stack hierarchies while maintaining React context propagation.",
        "source_title": "Top 25 ReactJS Interview Questions"
    },
    {
        "category": "React",
        "company": "General",
        "role": "React Concept",
        "question": "Why and how should you clean up Event Listeners in React?",
        "solution": "If you attach an event listener in `useEffect` and do not remove it when the component unmounts, the listener remains active, causing memory leaks and unexpected behaviors (state updates on unmounted components).\n\n```javascript\nuseEffect(() => {\n  const handleResize = () => console.log(window.innerWidth);\n  window.addEventListener('resize', handleResize);\n  return () => window.removeEventListener('resize', handleResize);\n}, []);\n```",
        "source_title": "Top 25 ReactJS Interview Questions"
    },
    {
        "category": "React",
        "company": "General",
        "role": "React Concept",
        "question": "What is the difference between useEffect and useLayoutEffect?",
        "solution": "`useEffect` runs asynchronously after the render has been committed and painted to the screen. It is non-blocking and is suitable for most side-effects like data fetching or event listeners.\n\n`useLayoutEffect` runs synchronously after DOM mutations but before the browser paints the screen. It is blocking and should be used to measure DOM elements and perform layout changes before paint to avoid visual flashes.",
        "source_title": "Top 25 ReactJS Interview Questions"
    },
    {
        "category": "React",
        "company": "General",
        "role": "React Concept",
        "question": "Compare React.memo, useMemo, and useCallback in React.",
        "solution": "- **React.memo**: A higher-order component that memoizes a component itself to prevent re-renders if its props have not changed.\n- **useMemo**: A hook that memoizes the computed result of an expensive calculation: `const val = useMemo(() => computeValue(a), [a])`.\n- **useCallback**: A hook that memoizes a function definition itself to prevent redeclaration on every render, preserving referential equality: `const fn = useCallback(() => doSomething(), [])`.",
        "source_title": "Top 25 ReactJS Interview Questions"
    },
    {
        "category": "React",
        "company": "General",
        "role": "React Concept",
        "question": "What is the difference between Controlled and Uncontrolled components?",
        "solution": "- **Controlled Components**: The input state is completely managed by React state (`value` and `onChange`). React is the single source of truth.\n- **Uncontrolled Components**: The input state is managed directly by the DOM. Values are accessed using `ref` pointers. Useful for integrating third-party libraries or handling file uploads.",
        "source_title": "Top 25 ReactJS Interview Questions"
    },
    {
        "category": "React",
        "company": "General",
        "role": "React Concept",
        "question": "Explain React Server Components (RSC) vs Client Components.",
        "solution": "- **Server Components**: Rendered exclusively on the server. They do not ship JavaScript to the client (reducing bundle sizes), can query databases/APIs directly, but cannot use client hooks (`useState`, `useEffect`) or event handlers.\n- **Client Components** (marked with `'use client'`): Rendered on the server but hydrated on the client. They support interactivity, DOM events, and React state/lifecycle hooks.",
        "source_title": "Top 25 ReactJS Interview Questions"
    },
    {
        "category": "React",
        "company": "General",
        "role": "React Concept",
        "question": "What are the key Rules of Hooks in React?",
        "solution": "1. **Only Call Hooks at the Top Level**: Do not call hooks inside loops, conditions, or nested functions. This ensures hooks execute in the same order on every render.\n2. **Only Call Hooks from React Functions**: Only call hooks from functional components or custom hooks (not regular JavaScript functions).",
        "source_title": "Top 25 ReactJS Interview Questions"
    },
    {
        "category": "React",
        "company": "General",
        "role": "React Concept",
        "question": "What are the performance trade-offs of using React's Context API?",
        "solution": "While Context solves prop drilling, any update to the context value forces all components consuming that context to re-render. If context holds a large state object, simple changes can cause widespread unnecessary re-renders.\n\nMitigation:\n1) Split context into separate State and Dispatch contexts.\n2) Wrap consumer components in `React.memo`.\n3) Use dedicated libraries like Zustand/Redux for high-frequency updates.",
        "source_title": "Top 25 ReactJS Interview Questions"
    },
    {
        "category": "React",
        "company": "General",
        "role": "React Concept",
        "question": "Why are key props crucial when rendering lists in React?",
        "solution": "Keys help React identify which items have changed, been added, or been removed in a list. Without keys, React will use indices by default, which can cause state bugs (e.g. inputs showing content of deleted items) and poor performance, as React will recreate DOM elements rather than shifting them.",
        "source_title": "Top 25 ReactJS Interview Questions"
    },
    {
        "category": "React",
        "company": "General",
        "role": "React Concept",
        "question": "What is the difference between Server-Side Rendering (SSR) and Client-Side Rendering (CSR)?",
        "solution": "- **Client-Side Rendering**: Browser downloads an empty HTML shell, then loads JS bundle which builds and paints the DOM. Downside: poor SEO, slow initial load.\n- **Server-Side Rendering**: Server renders page to HTML string and sends it to the browser. Browser displays static page, then downloads JS to 'hydrate' it (attach listeners). Benefit: faster perceived load time, optimal SEO.",
        "source_title": "Top 25 ReactJS Interview Questions"
    },

    # --- REACT HUB: CODING CHALLENGES ---
    {
        "category": "React",
        "company": "Apple",
        "role": "Senior Frontend Engineer",
        "question": "Build a reusable Star Rating component in React. Requirements: 1) Click to set rating, 2) Hover states (stars fill up to hovered star), 3) Support fractional ratings (e.g. 3.5 stars, half-filled), 4) Optimize rendering performance to support up to 1,000+ stars on the page without lag.",
        "solution": "```javascript\nimport React, { useState, useCallback } from 'react';\n\n// Memoized Star component utilizing SVG path and linearGradient fill\nconst Star = React.memo(({ index, filled, half, onHover, onClick }) => {\n  const fillValue = filled ? \"url(#full)\" : half ? \"url(#half)\" : \"none\";\n  return (\n    <svg \n      onClick={() => onClick(index)} \n      onMouseEnter={() => onHover(index)} \n      width=\"24\" \n      height=\"24\" \n      viewBox=\"0 0 24 24\"\n      style={{ cursor: 'pointer', transition: 'transform 0.1s' }}\n      className=\"star-icon\"\n    >\n      <defs>\n        <linearGradient id=\"half\">\n          <stop offset=\"50%\" stopColor=\"#fbbf24\"/>\n          <stop offset=\"50%\" stopColor=\"#e2e8f0\"/>\n        </linearGradient>\n        <linearGradient id=\"full\">\n          <stop offset=\"100%\" stopColor=\"#fbbf24\"/>\n        </linearGradient>\n      </defs>\n      <path \n        d=\"M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192z\" \n        fill={fillValue} \n        stroke=\"#d1d5db\"\n      />\n    </svg>\n  );\n});\nStar.displayName = 'Star';\n\nexport default function StarRating({ totalStars = 5, initialRating = 0 }) {\n  const [rating, setRating] = useState(initialRating);\n  const [hoverRating, setHoverRating] = useState(null);\n  \n  const handleHover = useCallback((index) => setHoverRating(index), []);\n  const handleLeave = useCallback(() => setHoverRating(null), []);\n  const handleClick = useCallback((index) => setRating(index), []);\n\n  return (\n    <div className=\"flex gap-1\" onMouseLeave={handleLeave}>\n      {[...Array(totalStars)].map((_, i) => {\n        const starIndex = i + 1;\n        const isFilled = hoverRating !== null ? starIndex <= hoverRating : starIndex <= Math.floor(rating);\n        const isHalf = hoverRating !== null ? false : !isFilled && starIndex === Math.ceil(rating) && rating % 1 !== 0;\n        return (\n          <Star \n            key={starIndex} \n            index={starIndex} \n            filled={isFilled} \n            half={isHalf} \n            onHover={handleHover} \n            onClick={handleClick} \n          />\n        );\n      })}\n    </div>\n  );\n}\n```",
        "source_title": "My Apple Frontend Interview Experience | 85 LPA | Hyderabad"
    },
    {
        "category": "React",
        "company": "MakeMyTrip",
        "role": "Senior Frontend Engineer",
        "question": "Implement a Reddit-style nested comment system in React. Requirements: 1) Support adding nested replies to any comment node, 2) Support deleting comments, 3) Handle unlimited recursion rendering, 4) Support collapse/expand states for threads, 5) Utilize immutable state updates.",
        "solution": "```javascript\nimport React, { useState } from 'react';\n\nconst CommentNode = ({ comment, onAddReply, onDelete }) => {\n  const [showReplyInput, setShowReplyInput] = useState(false);\n  const [replyText, setReplyText] = useState('');\n  const [collapsed, setCollapsed] = useState(false);\n\n  const handleReplySubmit = () => {\n    if (replyText.trim()) {\n      onAddReply(comment.id, replyText);\n      setReplyText('');\n      setShowReplyInput(false);\n    }\n  };\n\n  return (\n    <div className=\"pl-6 border-l-2 border-purple-100 my-4\">\n      <div className=\"bg-gray-50 p-3 rounded-lg\">\n        <div className=\"flex justify-between items-center text-xs text-gray-500 mb-2\">\n          <span>User</span>\n          <button onClick={() => setCollapsed(!collapsed)} className=\"text-purple-600 font-semibold\">\n            [{collapsed ? 'Expand' : 'Collapse'}]\n          </button>\n        </div>\n        {!collapsed && (\n          <>\n            <p className=\"text-gray-800 text-sm mb-3\">{comment.text}</p>\n            <div className=\"flex gap-4 text-xs\">\n              <button onClick={() => setShowReplyInput(!showReplyInput)} className=\"text-purple-600 hover:underline\">Reply</button>\n              <button onClick={() => onDelete(comment.id)} className=\"text-red-500 hover:underline\">Delete</button>\n            </div>\n            {showReplyInput && (\n              <div className=\"mt-3 flex gap-2\">\n                <input \n                  type=\"text\" \n                  value={replyText} \n                  onChange={(e) => setReplyText(e.target.value)} \n                  className=\"border rounded px-3 py-1 text-sm flex-1\" \n                  placeholder=\"Write a reply...\"\n                />\n                <button onClick={handleReplySubmit} className=\"bg-purple-600 text-white px-3 py-1 rounded text-sm\">Submit</button>\n              </div>\n            )}\n          </>\n        )}\n      </div>\n      {!collapsed && comment.replies && comment.replies.map(reply => (\n        <CommentNode key={reply.id} comment={reply} onAddReply={onAddReply} onDelete={onDelete} />\n      ))}\n    </div>\n  );\n};\n```",
        "source_title": "MakeMyTrip (MMT) Frontend Interview Experience | SSE-2"
    },
    {
        "category": "React",
        "company": "Goibibo",
        "role": "Senior Frontend Engineer",
        "question": "Build a React progress bar queue system (Sequential Progress Bars). Requirements: 1) Click 'Add' to create a progress bar, 2) Each bar completes in ~2s, 3) Only one progress bar runs at a time, 4) Added bars enter a queue and execute sequentially.",
        "solution": "```javascript\nimport React, { useState, useEffect, useRef } from 'react';\n\nexport default function QueueProgressBars() {\n  const [bars, setBars] = useState([]);\n  const [queue, setQueue] = useState([]);\n  const [activeId, setActiveId] = useState(null);\n  const timerRef = useRef(null);\n\n  const addProgressBar = () => {\n    const newId = Date.now();\n    setBars(prev => [...prev, { id: newId, progress: 0 }]);\n    setQueue(prev => [...prev, newId]);\n  };\n\n  useEffect(() => {\n    if (activeId === null && queue.length > 0) {\n      const nextId = queue[0];\n      setQueue(prev => prev.slice(1));\n      setActiveId(nextId);\n    }\n  }, [activeId, queue]);\n\n  useEffect(() => {\n    if (activeId !== null) {\n      timerRef.current = setInterval(() => {\n        setBars(prev => {\n          return prev.map(bar => {\n            if (bar.id === activeId) {\n              if (bar.progress >= 100) {\n                clearInterval(timerRef.current);\n                setActiveId(null);\n                return { ...bar, progress: 100 };\n              }\n              return { ...bar, progress: bar.progress + 10 };\n            }\n            return bar;\n          });\n        });\n      }, 200);\n    }\n    return () => clearInterval(timerRef.current);\n  }, [activeId]);\n\n  return (\n    <div className=\"p-4 max-w-md mx-auto\">\n      <button onClick={addProgressBar} className=\"bg-purple-600 text-white px-4 py-2 rounded mb-4\">Add Progress Bar</button>\n      <div className=\"space-y-3\">\n        {bars.map(bar => (\n          <div key={bar.id} className=\"w-full bg-gray-200 h-6 rounded overflow-hidden relative\">\n            <div style={{ width: `${bar.progress}%` }} className=\"bg-purple-500 h-full transition-all duration-100\"></div>\n            <span className=\"absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700\">{bar.progress}%</span>\n          </div>\n        ))}\n      </div>\n    </div>\n  );\n}\n```",
        "source_title": "Goibibo Frontend Interview Experience | SSE-2"
    },
    {
        "category": "React",
        "company": "Goibibo",
        "role": "Senior Frontend Engineer",
        "question": "Build a VS Code style recursive File Explorer in React. Requirements: 1) Expand/collapse folders, 2) Add files and folders dynamically, 3) Highlight selected file visually, 4) Support infinite recursive nesting.",
        "solution": "```javascript\nimport React, { useState } from 'react';\n\nexport const FolderNode = ({ node, onAddNode, onSelectNode, selectedId }) => {\n  const [expanded, setExpanded] = useState(true);\n  const [showInput, setShowInput] = useState(null);\n  const [name, setName] = useState('');\n\n  const handleCreate = () => {\n    if (name.trim()) {\n      onAddNode(node.id, name, showInput === 'folder');\n      setName('');\n      setShowInput(null);\n    }\n  };\n\n  return (\n    <div className=\"pl-4 my-1\">\n      <div className=\"flex items-center justify-between p-1 hover:bg-gray-100 rounded\">\n        <span onClick={() => node.isFolder ? setExpanded(!expanded) : onSelectNode(node.id)}\n              className={`cursor-pointer text-sm ${selectedId === node.id ? 'text-purple-600 font-bold' : ''}`}>\n          {node.isFolder ? (expanded ? '📂 ' : '📁 ') : '📄 '} {node.name}\n        </span>\n        {node.isFolder && (\n          <div className=\"flex gap-2 text-xs\">\n            <button onClick={() => setShowInput('file')} className=\"text-gray-500 hover:text-purple-600\">+ File</button>\n            <button onClick={() => setShowInput('folder')} className=\"text-gray-500 hover:text-purple-600\">+ Folder</button>\n          </div>\n        )}\n      </div>\n      {showInput && (\n        <div className=\"pl-6 flex gap-2 my-1\">\n          <input type=\"text\" value={name} onChange={e => setName(e.target.value)} className=\"border text-xs px-2 py-0.5 rounded\" />\n          <button onClick={handleCreate} className=\"bg-purple-600 text-white text-xs px-2 rounded\">OK</button>\n        </div>\n      )}\n      {node.isFolder && expanded && node.children && node.children.map(child => (\n        <FolderNode key={child.id} node={child} onAddNode={onAddNode} onSelectNode={onSelectNode} selectedId={selectedId} />\n      ))}\n    </div>\n  );\n};\n```",
        "source_title": "Goibibo Frontend Interview Experience | SSE-2"
    },
    {
        "category": "React",
        "company": "Okta",
        "role": "Frontend Engineer II (SDE-2)",
        "question": "Build a dynamic incremental cell grid in React. Requirements: 1) Input n rendering n x n grid, 2) Click empty cell -> fill with max(existing) + 1, 3) Click filled cell -> set to max(existing), 4) Optimize value calculation to avoid redundant grid iterations.",
        "solution": "```javascript\nimport React, { useState, useMemo } from 'react';\n\nexport default function DynamicGrid() {\n  const [n, setN] = useState(3);\n  const [grid, setGrid] = useState({});\n  const [maxVal, setMaxVal] = useState(0);\n\n  const handleCellClick = (key) => {\n    const current = grid[key];\n    const isFilled = current !== undefined;\n    const nextVal = isFilled ? maxVal : maxVal + 1;\n    \n    setGrid(prev => ({ ...prev, [key]: nextVal }));\n    if (!isFilled) {\n      setMaxVal(nextVal);\n    }\n  };\n\n  const cells = useMemo(() => {\n    const list = [];\n    for (let r = 0; r < n; r++) {\n      for (let c = 0; c < n; c++) {\n        list.push(`${r}-${c}`);\n      }\n    }\n    return list;\n  }, [n]);\n\n  return (\n    <div className=\"p-4 max-w-sm mx-auto\">\n      <input type=\"number\" value={n} onChange={e => { setGrid({}); setMaxVal(0); setN(Number(e.target.value)); }} className=\"border p-2 mb-4 w-full\" />\n      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: '8px' }}>\n        {cells.map(key => (\n          <div key={key} onClick={() => handleCellClick(key)} className=\"border h-12 flex items-center justify-center font-bold bg-gray-50 hover:bg-gray-100 cursor-pointer rounded\">\n            {grid[key] || ''}\n          </div>\n        ))}\n      </div>\n    </div>\n  );\n}\n```",
        "source_title": "Okta SDE-2 Frontend Interview Experience | 45 LPA"
    },
    {
        "category": "React",
        "company": "PayPal",
        "role": "Senior Frontend Engineer",
        "question": "Build a React Shopping Cart interface. Requirements: 1) Add and remove products, 2) Increment/decrement quantities, 3) Calculate total price dynamically, 4) Disable checkout button when the cart is empty.",
        "solution": "```javascript\nimport React, { useState, useMemo } from 'react';\n\nexport default function ShoppingCart() {\n  const [items, setItems] = useState([\n    { id: 1, name: 'Product A', price: 10, quantity: 1 },\n    { id: 2, name: 'Product B', price: 15, quantity: 2 }\n  ]);\n\n  const handleQuantity = (id, delta) => {\n    setItems(prev => prev.map(item => {\n      if (item.id === id) {\n        const qty = Math.max(1, item.quantity + delta);\n        return { ...item, quantity: qty };\n      }\n      return item;\n    }));\n  };\n\n  const handleRemove = (id) => {\n    setItems(prev => prev.filter(item => item.id !== id));\n  };\n\n  const total = useMemo(() => {\n    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);\n  }, [items]);\n\n  return (\n    <div className=\"p-4 border rounded-lg max-w-md mx-auto\">\n      <h2 className=\"font-bold mb-4\">Shopping Cart</h2>\n      {items.map(item => (\n        <div key={item.id} className=\"flex justify-between items-center my-2\">\n          <span>{item.name} (${item.price})</span>\n          <div className=\"flex items-center gap-2\">\n            <button onClick={() => handleQuantity(item.id, -1)} className=\"border px-2\">-</button>\n            <span>{item.quantity}</span>\n            <button onClick={() => handleQuantity(item.id, 1)} className=\"border px-2\">+</button>\n            <button onClick={() => handleRemove(item.id)} className=\"text-red-500 ml-4\">Remove</button>\n          </div>\n        </div>\n      ))}\n      <div className=\"mt-4 border-t pt-2 font-bold\">Total: ${total}</div>\n      <button disabled={items.length === 0} className=\"mt-4 bg-purple-600 text-white w-full py-2 disabled:bg-gray-300\">Checkout</button>\n    </div>\n  );\n}\n```",
        "source_title": "PayPal Frontend Interview Experience | 52 LPA | SSE"
    },
    {
        "category": "React",
        "company": "Paytm Money",
        "role": "Senior Frontend Engineer",
        "question": "Build a Stopwatch component in React. Requirements: 1) Start, Pause, and Restart buttons, 2) Handle interval timing correctly, 3) Ensure complete cleanup on component unmount to prevent memory leaks.",
        "solution": "```javascript\nimport React, { useState, useRef, useEffect } from 'react';\n\nexport default function Stopwatch() {\n  const [time, setTime] = useState(0);\n  const [isRunning, setIsRunning] = useState(false);\n  const intervalRef = useRef(null);\n\n  const startTimer = () => {\n    if (!isRunning) {\n      setIsRunning(true);\n      intervalRef.current = setInterval(() => {\n        setTime(prev => prev + 10);\n      }, 10);\n    }\n  };\n\n  const pauseTimer = () => {\n    setIsRunning(false);\n    clearInterval(intervalRef.current);\n  };\n\n  const restartTimer = () => {\n    setIsRunning(false);\n    clearInterval(intervalRef.current);\n    setTime(0);\n  };\n\n  useEffect(() => {\n    return () => clearInterval(intervalRef.current);\n  }, []);\n\n  return (\n    <div className=\"p-4 border rounded max-w-xs mx-auto text-center\">\n      <div className=\"text-2xl font-mono mb-4\">{(time / 1000).toFixed(2)}s</div>\n      <div className=\"flex gap-2 justify-center\">\n        <button onClick={startTimer} className=\"bg-green-500 text-white px-3 py-1\">Start</button>\n        <button onClick={pauseTimer} className=\"bg-yellow-500 text-white px-3 py-1\">Pause</button>\n        <button onClick={restartTimer} className=\"bg-red-500 text-white px-3 py-1\">Reset</button>\n      </div>\n    </div>\n  );\n}\n```",
        "source_title": "Paytm Money Frontend Interview Experience | SSE 2026"
    },
    {
        "category": "React",
        "company": "Paytm Money",
        "role": "Senior Frontend Engineer",
        "question": "Create a custom React hook `useDidUpdate(callback, deps)` that fires the callback on dependency changes but bypasses execution on the initial mount.",
        "solution": "```javascript\nimport { useEffect, useRef } from 'react';\n\nexport function useDidUpdate(callback, deps) {\n  const isFirstRender = useRef(true);\n\n  useEffect(() => {\n    if (isFirstRender.current) {\n      isFirstRender.current = false;\n      return;\n    }\n    return callback();\n  }, deps);\n}\n```",
        "source_title": "Paytm Money Frontend Interview Experience | SSE 2026"
    },
    {
        "category": "React",
        "company": "JioHotstar",
        "role": "Senior Frontend Engineer",
        "question": "Build a reusable, keyboard-accessible Dropdown component in React. Requirements: 1) Custom trigger slot, 2) Mouse hover / click toggling, 3) Full keyboard focus (Up/Down arrow selects items, Enter confirms, Escape closes).",
        "solution": "```javascript\nimport React, { useState, useRef, useEffect } from 'react';\n\nexport default function Dropdown({ label, items, onSelect }) {\n  const [isOpen, setIsOpen] = useState(false);\n  const [activeIndex, setActiveIndex] = useState(-1);\n  const dropdownRef = useRef(null);\n\n  const handleKeyDown = (e) => {\n    if (!isOpen) return;\n    if (e.key === 'ArrowDown') {\n      e.preventDefault();\n      setActiveIndex(prev => (prev + 1) % items.length);\n    } else if (e.key === 'ArrowUp') {\n      e.preventDefault();\n      setActiveIndex(prev => (prev - 1 + items.length) % items.length);\n    } else if (e.key === 'Enter' && activeIndex >= 0) {\n      onSelect(items[activeIndex]);\n      setIsOpen(false);\n    } else if (e.key === 'Escape') {\n      setIsOpen(false);\n    }\n  };\n\n  useEffect(() => {\n    const handleClickOutside = (e) => {\n      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {\n        setIsOpen(false);\n      }\n    };\n    document.addEventListener('mousedown', handleClickOutside);\n    return () => document.removeEventListener('mousedown', handleClickOutside);\n  }, []);\n\n  return (\n    <div ref={dropdownRef} onKeyDown={handleKeyDown} className=\"relative inline-block\">\n      <button onClick={() => setIsOpen(!isOpen)} className=\"border px-4 py-2\">{label}</button>\n      {isOpen && (\n        <ul className=\"absolute z-10 bg-white border mt-1 w-40 shadow-lg\">\n          {items.map((item, idx) => (\n            <li key={idx} onClick={() => { onSelect(item); setIsOpen(false); }}\n                className={`px-4 py-2 cursor-pointer ${idx === activeIndex ? 'bg-purple-100' : 'hover:bg-gray-100'}`}>\n              {item}\n            </li>\n          ))}\n        </ul>\n      )}\n    </div>\n  );\n}\n```",
        "source_title": "JioHotstar Frontend Interview Experience | 48 LPA | SDE-2"
    },

    # --- JAVASCRIPT CORE ---
    {
        "category": "JavaScript (Core)",
        "company": "MakeMyTrip",
        "role": "Senior Frontend Engineer",
        "question": "Implement a promise retry helper function `retry(fetchData, retries)` without using async/await. The function should retry a failed API call up to N times, resolving immediately upon success or rejecting after all retries fail.",
        "solution": "```javascript\n/**\n * Retries a promise-returning function sequential times.\n * @param {() => Promise<any>} fetchData\n * @param {number} retries\n * @returns {Promise<any>}\n */\nfunction retry(fetchData, retries) {\n  return new Promise((resolve, reject) => {\n    fetchData()\n      .then(resolve)\n      .catch((error) => {\n        if (retries > 0) {\n          retry(fetchData, retries - 1)\n            .then(resolve)\n            .catch(reject);\n        } else {\n          reject(error);\n        }\n      });\n  });\n}\n```",
        "source_title": "MakeMyTrip (MMT) Frontend Interview Experience | SSE-2"
    },
    {
        "category": "JavaScript (Core)",
        "company": "LinkedIn",
        "role": "Senior Frontend Engineer",
        "question": "Implement a reusable memoization utility `memoize(fn)` supporting caching of function results based on serializable arguments.",
        "solution": "```javascript\n/**\n * Memoizes a function based on arguments using closures.\n * @param {Function} fn\n * @returns {Function}\n */\nfunction memoize(fn) {\n  const cache = new Map();\n  \n  return function(...args) {\n    const key = JSON.stringify(args);\n    if (cache.has(key)) {\n      return cache.get(key);\n    }\n    const result = fn.apply(this, args);\n    cache.set(key, result);\n    return result;\n  };\n}\n```",
        "source_title": "LinkedIn Senior Frontend Engineer Interview Experience | 2026"
    },
    {
        "category": "JavaScript (Core)",
        "company": "Goibibo",
        "role": "Senior Frontend Engineer",
        "question": "Implement a custom array flattening function: 1) using recursion, 2) iteratively without recursion (using an execution stack).",
        "solution": "```javascript\n// 1. Recursive array flattening using Array.prototype.reduce\nfunction flattenRecursive(arr) {\n  return arr.reduce((acc, val) => \n    Array.isArray(val) ? acc.concat(flattenRecursive(val)) : acc.concat(val)\n  , []);\n}\n\n// 2. Iterative array flattening using a Stack data structure\nfunction flattenIterative(arr) {\n  const stack = [...arr];\n  const result = [];\n  \n  while (stack.length) {\n    const next = stack.pop();\n    if (Array.isArray(next)) {\n      stack.push(...next);\n    } else {\n      result.push(next);\n    }\n  }\n  return result.reverse();\n}\n```",
        "source_title": "Goibibo Frontend Interview Experience | SSE-2"
    },
    {
        "category": "JavaScript (Core)",
        "company": "Moniepoint",
        "role": "Frontend Engineer",
        "question": "Write a TypeScript/JavaScript decorator helper `enforceTimeLimit(apiFn, timeLimit)` that returns a modified version of `apiFn`. If the API takes longer than `timeLimit` milliseconds to execute, the returned promise should reject with 'Time Limit Exceeded'. Otherwise, it resolves with the API results.",
        "solution": "```typescript\n/**\n * Enforces a time limit constraint on a promise-returning function.\n */\nconst enforceTimeLimit = (\n  apiFn: (...args: any[]) => Promise<any>,\n  timeLimit: number\n) => {\n  return (...args: any[]): Promise<any> => {\n    const timeoutPromise = new Promise((_, reject) => {\n      setTimeout(() => reject(\"Time Limit Exceeded\"), timeLimit);\n    });\n    return Promise.race([\n      apiFn(...args),\n      timeoutPromise\n    ]);\n  };\n};\n```",
        "source_title": "MoniePoint Frontend Interview Experience | 55 LPA Remote"
    },
    {
        "category": "JavaScript (Core)",
        "company": "PayPal",
        "role": "Senior Frontend Engineer",
        "question": "Implement a custom deep clone function that handles nested objects and arrays. Requirement: Whenever an array is encountered, append its size (length) to the cloned array without modifying the original object.",
        "solution": "```javascript\n/**\n * Custom deep clone utility with index manipulation.\n */\nfunction deepClone(obj) {\n  if (Array.isArray(obj)) {\n    const clone = obj.map(deepClone);\n    clone.push(clone.length);\n    return clone;\n  }\n\n  if (obj && typeof obj === \"object\") {\n    const copy = {};\n    for (const key in obj) {\n      if (obj.hasOwnProperty(key)) {\n        copy[key] = deepClone(obj[key]);\n      }\n    }\n    return copy;\n  }\n  return obj;\n}\n```",
        "source_title": "PayPal Frontend Interview Experience | 52 LPA | SSE"
    },
    {
        "category": "JavaScript (Core)",
        "company": "Goibibo",
        "role": "Senior Frontend Engineer",
        "question": "Implement a custom promiseAllSync helper to execute promises sequentially using Promise chaining instead of async/await, maintaining resolution order.",
        "solution": "```javascript\nfunction promiseAllSync(promiseFactories) {\n  return new Promise((resolve, reject) => {\n    const results = [];\n    let chain = Promise.resolve();\n\n    promiseFactories.forEach((factory, index) => {\n      chain = chain\n        .then(() => factory())\n        .then(result => {\n          results[index] = result;\n        });\n    });\n\n    chain.then(() => resolve(results)).catch(reject);\n  });\n}\n```",
        "source_title": "Goibibo Frontend Interview Experience | SSE-2"
    },
    {
        "category": "JavaScript (Core)",
        "company": "Wayfair",
        "role": "Senior Frontend Engineer",
        "question": "Implement an EventEmitter/Observer class in JavaScript supporting registration (on), removal (off), and triggering (emit) of event handlers.",
        "solution": "```javascript\nclass EventEmitter {\n  constructor() {\n    this.events = new Map();\n  }\n\n  on(event, listener) {\n    if (!this.events.has(event)) {\n      this.events.set(event, []);\n    }\n    this.events.get(event).push(listener);\n    return () => this.off(event, listener);\n  }\n\n  off(event, listener) {\n    if (!this.events.has(event)) return;\n    const list = this.events.get(event).filter(l => l !== listener);\n    this.events.set(event, list);\n  }\n\n  emit(event, ...args) {\n    if (!this.events.has(event)) return;\n    this.events.get(event).forEach(listener => listener(...args));\n  }\n}\n```",
        "source_title": "Wayfair Frontend Interview Experience | SDE-2"
    },

    # --- CSS & HTML HUB ---
    {
        "category": "CSS & HTML",
        "company": "LinkedIn",
        "role": "Senior Frontend Engineer",
        "question": "Build a responsive Tooltip component using semantic HTML and CSS. Requirements: 1) Tooltip centered above target element, 2) Centered pointer arrow using pseudo-elements, 3) Support placements: top, bottom, left, right.",
        "solution": "```html\n<div class=\"tooltip-container\">\n  <a href=\"#\">Hover over me</a>\n  <span class=\"tooltip-text tooltip-top\">Tooltip content here</span>\n</div>\n\n<style>\n.tooltip-container {\n  position: relative;\n  display: inline-block;\n}\n.tooltip-text {\n  visibility: hidden;\n  background-color: #0f172a;\n  color: #fff;\n  text-align: center;\n  border-radius: 6px;\n  padding: 6px 12px;\n  position: absolute;\n  z-index: 10;\n  font-size: 12px;\n  opacity: 0;\n  transition: opacity 0.2s;\n}\n.tooltip-top {\n  bottom: 125%;\n  left: 50%;\n  transform: translateX(-50%);\n}\n.tooltip-top::after {\n  content: \"\";\n  position: absolute;\n  top: 100%;\n  left: 50%;\n  margin-left: -5px;\n  border-width: 5px;\n  border-style: solid;\n  border-color: #0f172a transparent transparent transparent;\n}\n.tooltip-container:hover .tooltip-text {\n  visibility: visible;\n  opacity: 1;\n}\n</style>\n```",
        "source_title": "LinkedIn Senior Frontend Engineer Interview Experience | 2026"
    },
    {
        "category": "CSS & HTML",
        "company": "Moniepoint",
        "role": "Frontend Engineer",
        "question": "Moniepoint Travel App code audit: Identify the bugs and structural errors in the provided debounced Search component code and useDebounce custom hook.",
        "solution": "```javascript\n// 1. Bug: useDebounce hook updates state immediately instead of delaying it.\n// Fix:\nfunction useDebounce(value, delay) {\n  const [debouncedValue, setDebouncedValue] = useState(value);\n  useEffect(() => {\n    const handler = setTimeout(() => setDebouncedValue(value), delay);\n    return () => clearTimeout(handler);\n  }, [value, delay]);\n  return debouncedValue;\n}\n\n// 2. Bug: SearchBox.jsx runs useDebounce(searchText, 10). 10ms is too low, use 300ms.\n// 3. Bug: fetchSearchResults and handleApartmentClick callbacks are redeclared on every render.\n// Fix: Wrap in useCallback and add dependency tracking.\n// 4. Bug: API requests have race conditions. Old slow responses can overwrite new fast results.\n// Fix: Implement AbortController to abort previous requests in useEffect.\n```",
        "source_title": "MoniePoint Frontend Interview Experience | 55 LPA Remote"
    },
    {
        "category": "CSS & HTML",
        "company": "Paytm Money",
        "role": "Senior Frontend Engineer",
        "question": "Explain and implement multiple methods to horizontally and vertically center a child div inside a parent element.",
        "solution": "```css\n/* Method 1: Flexbox (Recommended) */\n.parent-flex {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n\n/* Method 2: CSS Grid */\n.parent-grid {\n  display: grid;\n  place-items: center;\n}\n\n/* Method 3: Absolute Positioning */\n.parent-absolute {\n  position: relative;\n}\n.child-absolute {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%);\n}\n\n/* Method 4: Margin Auto (with flex) */\n.parent-margin-flex {\n  display: flex;\n}\n.child-margin-auto {\n  margin: auto;\n}\n```",
        "source_title": "Paytm Money Frontend Interview Experience | SSE 2026"
    },

    # --- ALGORITHMS & DATA STRUCTURES ---
    {
        "category": "Algorithms & Data Structures",
        "company": "Amazon",
        "role": "Frontend Engineer",
        "question": "Given a Binary Search Tree (BST), determine whether there exist three node values that sum to zero. Write an optimized solution.",
        "solution": "```javascript\n// Inorder Traversal retrieves BST nodes in sorted order: O(N) time\nfunction inorder(root, arr = []) {\n  if (!root) return arr;\n  inorder(root.left, arr);\n  arr.push(root.val);\n  inorder(root.right, arr);\n  return arr;\n}\n\n// Optimized 3Sum algorithm on sorted array: O(N^2) time, O(N) space\nfunction hasTriplet(root) {\n  const nums = inorder(root);\n  \n  for (let i = 0; i < nums.length - 2; i++) {\n    let left = i + 1;\n    let right = nums.length - 1;\n    \n    while (left < right) {\n      const sum = nums[i] + nums[left] + nums[right];\n      if (sum === 0) return true;\n      if (sum < 0) left++;\n      else right--;\n    }\n  }\n  return false;\n}\n```",
        "source_title": "Amazon Frontend Engineer Interview Experience | 2026"
    },
    {
        "category": "Algorithms & Data Structures",
        "company": "Amazon",
        "role": "Frontend Engineer",
        "question": "Given a row-wise sorted binary matrix of size R x C containing only 0s and 1s, find the row index containing the maximum number of 1s in O(R+C) time and O(1) space.",
        "solution": "```javascript\nfunction rowWithMaxOnes(matrix) {\n  let maxRow = -1;\n  const rows = matrix.length;\n  const cols = matrix[0].length;\n  let j = cols - 1; // Column pointer starting top-right\n  \n  for (let i = 0; i < rows; i++) {\n    while (j >= 0 && matrix[i][j] === 1) {\n      maxRow = i;\n      j--;\n    }\n  }\n  return maxRow;\n}\n```",
        "source_title": "Amazon Frontend Engineer Interview Experience | 2026"
    },
    {
        "category": "Algorithms & Data Structures",
        "company": "Oracle",
        "role": "Senior Frontend Engineer",
        "question": "Given two strings s1 and s2, find the length of the longest substring present in both strings. Expected Time Complexity: O(N * M).",
        "solution": "```javascript\nfunction longestCommonSubstring(s1, s2) {\n  const dp = Array.from(\n    { length: s1.length + 1 },\n    () => Array(s2.length + 1).fill(0)\n  );\n  let ans = 0;\n  for (let i = 1; i <= s1.length; i++) {\n    for (let j = 1; j <= s2.length; j++) {\n      if (s1[i - 1] === s2[j - 1]) {\n        dp[i][j] = dp[i - 1][j - 1] + 1;\n        ans = Math.max(ans, dp[i][j]);\n      }\n    }\n  }\n  return ans;\n}\n```",
        "source_title": "Oracle Frontend Interview Experience | Senior Frontend Engineer"
    },
    {
        "category": "Algorithms & Data Structures",
        "company": "LinkedIn",
        "role": "Senior Frontend Engineer",
        "question": "Implement Kadane's algorithm to find the maximum subarray sum, returning not only the sum but also the starting and ending indices in O(n) time.",
        "solution": "```javascript\nfunction maxSubArray(nums) {\n  let max = nums[0];\n  let current = nums[0];\n  let start = 0;\n  let end = 0;\n  let temp = 0;\n\n  for (let i = 1; i < nums.length; i++) {\n    if (nums[i] > current + nums[i]) {\n      current = nums[i];\n      temp = i;\n    } else {\n      current += nums[i];\n    }\n    if (current > max) {\n      max = current;\n      start = temp;\n      end = i;\n    }\n  }\n  return { max, start, end };\n}\n```",
        "source_title": "LinkedIn Senior Frontend Engineer Interview Experience | 2026"
    },
    {
        "category": "Algorithms & Data Structures",
        "company": "LinkedIn",
        "role": "Senior Frontend Engineer",
        "question": "Implement String.repeat(n) using a binary exponentiation approach to minimize string concatenations.",
        "solution": "```javascript\nString.prototype.myRepeat = function(n) {\n  if (n <= 0) return \"\";\n  if (n === 1) return this.toString();\n  if (n % 2 === 0) {\n    const half = this.myRepeat(n / 2);\n    return half + half;\n  }\n  return this + this.myRepeat(n - 1);\n};\n```",
        "source_title": "LinkedIn Senior Frontend Engineer Interview Experience | 2026"
    },
    {
        "category": "Algorithms & Data Structures",
        "company": "LinkedIn",
        "role": "Senior Frontend Engineer",
        "question": "Design a Calculator library in JavaScript supporting calculations, unlimited Undo states, and Redo capability using history stacks.",
        "solution": "```javascript\nfunction createCalculator() {\n  let value = 0;\n  const undoStack = [];\n  const redoStack = [];\n\n  return {\n    execute(operation, operand) {\n      undoStack.push(value);\n      redoStack.length = 0; // Clear redo on new actions\n      if (operation === 'add') value += operand;\n      if (operation === 'sub') value -= operand;\n      if (operation === 'mul') value *= operand;\n      if (operation === 'div') value /= operand;\n      return value;\n    },\n    undo() {\n      if (undoStack.length === 0) return value;\n      redoStack.push(value);\n      value = undoStack.pop();\n      return value;\n    },\n    redo() {\n      if (redoStack.length === 0) return value;\n      undoStack.push(value);\n      value = redoStack.pop();\n      return value;\n    },\n    value() {\n      return value;\n    }\n  };\n}\n```",
        "source_title": "LinkedIn Senior Frontend Engineer Interview Experience | 2026"
      }
]

def synthesize_knowledge(articles):
    """Aggregate only metadata and questions explicitly extracted from crawled articles."""
    synthesis = {
        "by_company": {},
        "by_category": {
            "React": [],
            "JavaScript (Core)": [],
            "CSS & HTML": [],
            "Algorithms & Data Structures": [],
            "System Design & Architecture": [],
            "General / Other" : []
        },
        "all_questions": [],
        "salary_insights": [],
        "general_advice": []
    }

    for art in articles:
        comp = art.get("company", "General")
        if comp not in synthesis["by_company"]:
            synthesis["by_company"][comp] = []

        article_questions = []
        for extracted in art.get("coding_questions", []):
            if isinstance(extracted, str):
                question = extracted.strip()
                details = {}
            elif isinstance(extracted, dict):
                question = str(extracted.get("question", "")).strip()
                details = extracted
            else:
                continue

            if not question:
                continue

            category = details.get("category") or categorize_question(f"{art.get('title', '')} {question}")
            if category not in synthesis["by_category"]:
                category = "General / Other"
            item = {
                "category": category,
                "company": comp,
                "role": art.get("role", "Frontend Engineer"),
                "question": question,
                "source_title": art.get("title", "Untitled article"),
                "source_url": art.get("original_url", "")
            }
            if details.get("solution"):
                item["solution"] = str(details["solution"])
            article_questions.append(item)
            synthesis["all_questions"].append(item)
            synthesis["by_category"][category].append(item)

        synthesis["by_company"][comp].append({
            "title": art.get("title", "Untitled article"),
            "url": art.get("original_url", ""),
            "date": art.get("date", ""),
            "role": art.get("role", "Frontend Engineer"),
            "salary": art.get("salary", "N/A"),
            "coding_questions": article_questions
        })

        if art.get("salary", "N/A") != "N/A":
            synthesis["salary_insights"].append({
                "company": comp,
                "role": art.get("role", "Frontend Engineer"),
                "salary": art["salary"],
                "source_title": art.get("title", "Untitled article")
            })

    report_path = os.path.join(DATA_DIR, "synthesized_knowledge.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Knowledge Synthesis: Gourav Hammad Medium Articles\n\n")
        f.write("This report contains only metadata and questions explicitly extracted from the crawled articles. Use the Codex Study Library for source-linked study notes and clearly labeled supplementary drills.\n\n")

        f.write("## 1. Salary & Compensation Insights\n")
        f.write("Table summarizing compensation stated in the crawled interview experiences:\n\n")
        f.write("| Company | Role | Stated Compensation |\n")
        f.write("|---|---|---|\n")
        for sal in sorted(synthesis["salary_insights"], key=lambda x: x["company"]):
            f.write(f"| {sal['company']} | {sal['role']} | **{sal['salary']}** |\n")
        f.write("\n")

        f.write("## 2. Technical Interview Questions by Category\n\n")
        for cat, qs in sorted(synthesis["by_category"].items()):
            f.write(f"### {cat}\n")
            if qs:
                for item in qs:
                    f.write(f"#### {item['company']} ({item['role']})\n")
                    f.write(f"**Challenge**: {item['question']}\n\n")
                    f.write(f"**Source**: [{item['source_title']}]({item['source_url']})\n\n")
                    if "solution" in item:
                        f.write(f"**Solution**:\n{item['solution']}\n\n")
            else:
                f.write("- *No questions were explicitly extracted for this category.*\n")
            f.write("\n")

    print(f"Saved synthesized report to: {report_path}")
    return synthesis

def main():
    import sys

    synthesize_only = len(sys.argv) > 1 and sys.argv[1] == "--synthesize-only"
    cli_url = None
    if len(sys.argv) > 1 and not synthesize_only:
        cli_url = sys.argv[1].strip()
        if '?' in cli_url:
            cli_url = cli_url.split('?')[0]
        print(f"Received CLI URL to crawl: {cli_url}")

    # Load existing data first if it exists to avoid recrawling
    existing_data = []
    posts_path = os.path.join(DATA_DIR, "crawled_posts.json")
    if os.path.exists(posts_path):
        try:
            with open(posts_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
        except Exception as e:
            print(f"Error loading existing data: {e}")

    # Gather already crawled URLs
    crawled_urls = {art["original_url"] for art in existing_data}
    
    if synthesize_only:
        print("Rebuilding synthesis from existing crawled articles...")
    elif cli_url:
        # Crawl only the CLI URL
        # Remove old version if it was already crawled to update it
        existing_data = [art for art in existing_data if art["original_url"] != cli_url]
        try:
            art_data = scrape_article(cli_url)
            if art_data:
                existing_data.append(art_data)
                print(f"Successfully scraped and added CLI URL: {cli_url}")
            else:
                print(f"Failed to scrape CLI URL: {cli_url}")
        except Exception as e:
            print(f"Failed to crawl CLI URL {cli_url}: {e}")
    else:
        # Normal feed run: Discover URLs from RSS + Seeds
        discovered = parse_rss_feeds()
        print(f"Found {len(discovered)} articles in RSS feed.")
        
        all_urls = list(set(SEED_URLS + discovered))
        print(f"Total unique URLs to crawl: {len(all_urls)}")
        
        new_count = 0
        for url in all_urls:
            if url not in crawled_urls:
                try:
                    art_data = scrape_article(url)
                    if art_data:
                        existing_data.append(art_data)
                        new_count += 1
                except Exception as e:
                    print(f"Failed to crawl {url}: {e}")
            else:
                print(f"Skipping already crawled: {url}")
        print(f"Incremental crawl complete. Scraped {new_count} new articles.")
                
    # Save crawled posts JSON
    with open(posts_path, "w", encoding="utf-8") as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(existing_data)} posts to: {posts_path}")
    
    # Synthesize and Save
    synthesis = synthesize_knowledge(existing_data)
    synthesis_path = os.path.join(DATA_DIR, "synthesized_knowledge.json")
    with open(synthesis_path, "w", encoding="utf-8") as f:
        json.dump(synthesis, f, indent=2, ensure_ascii=False)
    print(f"Saved synthesis to: {synthesis_path}")

if __name__ == "__main__":
    main()
