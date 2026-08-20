// Global App State
let appData = {
  crawled_posts: [],
  synthesis: {}
};
let selectedCategory = 'all';
let searchQuery = '';

// Load initial dashboard data
async function loadData() {
  try {
    const response = await fetch('/api/data');
    const res = await response.json();
    if (res.success) {
      appData.crawled_posts = res.crawled_posts || [];
      appData.synthesis = res.synthesis || {};
      
      updateStatistics();
      renderCategoryFilters();
      renderArticles();
      renderSynthesisTabContent();
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

// Update Hero & Sidebar stats cards
function updateStatistics() {
  const postsCount = appData.crawled_posts.length;
  
  // Calculate distinct companies
  const companies = new Set();
  let maxSalaryVal = 0;
  let maxSalaryStr = 'N/A';
  
  appData.crawled_posts.forEach(post => {
    if (post.company && post.company !== 'General') {
      companies.add(post.company);
    }
    
    // Parse max salary (simple heuristic: e.g. "85 LPA" -> 85)
    if (post.salary && post.salary !== 'N/A') {
      const match = post.salary.match(/(\d+)/);
      if (match) {
        const val = parseInt(match[0]);
        if (post.salary.toLowerCase().includes('lpa') || post.salary.toLowerCase().includes('lakh')) {
          if (val > maxSalaryVal) {
            maxSalaryVal = val;
            maxSalaryStr = `${val} LPA`;
          }
        } else if (post.salary.toLowerCase().includes('$') || post.salary.toLowerCase().includes('k')) {
          // simple scale adjustment for comparison
          const usdVal = val * 0.85; // approximate conversion for sorting
          if (usdVal > maxSalaryVal) {
            maxSalaryVal = usdVal;
            maxSalaryStr = post.salary;
          }
        }
      }
    }
  });
  
  document.getElementById('stat-posts').textContent = postsCount;
  document.getElementById('stat-companies').textContent = companies.size || 11; // fallback to count
  document.getElementById('stat-salary').textContent = maxSalaryStr !== 'N/A' ? maxSalaryStr : '85 LPA';
}

// Render dynamic tag filters in the sidebar
function renderCategoryFilters() {
  const filterList = document.getElementById('category-filter-list');
  filterList.innerHTML = '';
  
  // Gather unique tags
  const tags = new Set();
  appData.crawled_posts.forEach(post => {
    if (post.tags) {
      post.tags.forEach(tag => tags.add(tag.toLowerCase()));
    }
    // Also include company names as categories
    if (post.company && post.company !== 'General') {
      tags.add(post.company.toLowerCase());
    }
  });
  
  // Add "All" badge
  const allBtn = document.createElement('div');
  allBtn.className = `tag-badge-sidebar ${selectedCategory === 'all' ? 'active' : ''}`;
  allBtn.innerHTML = `📁 all`;
  allBtn.addEventListener('click', () => {
    selectedCategory = 'all';
    document.querySelectorAll('.tag-badge-sidebar').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    renderArticles();
  });
  filterList.appendChild(allBtn);
  
  // Add other tags
  const sortedTags = Array.from(tags).sort();
  sortedTags.forEach(tag => {
    const badge = document.createElement('div');
    badge.className = `tag-badge-sidebar ${selectedCategory === tag ? 'active' : ''}`;
    badge.innerHTML = `# ${tag}`;
    badge.addEventListener('click', () => {
      selectedCategory = tag;
      document.querySelectorAll('.tag-badge-sidebar').forEach(b => b.classList.remove('active'));
      badge.classList.add('active');
      renderArticles();
    });
    filterList.appendChild(badge);
  });
}

// Render article grid with search + category filters
function renderArticles() {
  const container = document.getElementById('articles-grid');
  container.innerHTML = '';
  
  let filtered = appData.crawled_posts;
  
  // 1. Filter by category/tag
  if (selectedCategory !== 'all') {
    filtered = filtered.filter(post => {
      const matchTag = post.tags && post.tags.some(t => t.toLowerCase() === selectedCategory);
      const matchComp = post.company && post.company.toLowerCase() === selectedCategory;
      return matchTag || matchComp;
    });
  }
  
  // 2. Filter by search query
  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(post => 
      post.title.toLowerCase().includes(query) || 
      (post.company && post.company.toLowerCase().includes(query)) ||
      (post.content_markdown && post.content_markdown.toLowerCase().includes(query))
    );
  }
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">
        No articles found matching your criteria.
      </div>
    `;
    return;
  }
  
  // Render cards sorted by date (if parseable, newest first)
  filtered.sort((a, b) => new Date(b.date || '') - new Date(a.date || ''));
  
  filtered.forEach(post => {
    const card = document.createElement('div');
    card.className = 'article-card';
    
    // Fallback excerpt
    const cleanContent = post.content_markdown ? post.content_markdown.replace(/[#*`>]/g, '') : '';
    const excerpt = cleanContent.length > 120 ? cleanContent.substring(0, 120) + '...' : cleanContent;
    
    const companyClass = `badge-${post.company ? post.company.toLowerCase() : 'general'}`;
    const salaryHtml = post.salary && post.salary !== 'N/A' ? `<span class="salary-tag">${post.salary}</span>` : '';
    
    card.innerHTML = `
      <div>
        <div class="card-header">
          <span class="company-badge ${companyClass}">${post.company || 'General'}</span>
          ${salaryHtml}
        </div>
        <h3 class="article-title">${post.title}</h3>
        <p class="article-excerpt">${excerpt || 'Read the full interview experience, technical rounds, questions, and insights.'}</p>
      </div>
      <div class="card-footer">
        <span class="article-date">${post.date || 'August 2026'}</span>
        <button class="read-btn">
          Read details
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </button>
      </div>
    `;
    
    card.addEventListener('click', () => openArticleModal(post));
    container.appendChild(card);
  });
}

// Render synthesis tabs contents
function renderSynthesisTabContent() {
  const synth = appData.synthesis;
  if (!synth) return;
  
  // 1. Populate Salaries
  const salaryTableBody = document.getElementById('salary-table-body');
  salaryTableBody.innerHTML = '';
  if (synth.salary_insights && synth.salary_insights.length > 0) {
    synth.salary_insights.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--text-primary);">${item.company}</td>
        <td>${item.role}</td>
        <td><span class="salary-tag">${item.salary}</span></td>
        <td><a href="${item.url}" target="_blank" style="color: var(--accent-purple); text-decoration: none;">View original ↗</a></td>
      `;
      salaryTableBody.appendChild(tr);
    });
  } else {
    salaryTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No salary data available</td></tr>`;
  }
  
  // 2. Populate DSA / Technical Questions grouped by dedicated tab challenges lists
  const allQuestions = synth.all_questions || [];
  
  function populateCategoryChallenges(elementId, filterFn) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';
    
    const filtered = allQuestions.filter(filterFn);
    if (filtered.length > 0) {
      filtered.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'challenge-card';
        
        const companyClass = `badge-${item.company ? item.company.toLowerCase().replace(/\s+/g, '-') : 'general'}`;
        
        const solutionHtml = item.solution ? `
          <details class="solution-details">
            <summary class="solution-summary">View Solution & Details</summary>
            <div class="solution-content">
              ${parseMarkdownToHTML(item.solution)}
            </div>
          </details>
        ` : '';

        itemEl.innerHTML = `
          <div class="challenge-card-header">
            <span class="company-badge ${companyClass}">${item.company || 'General'}</span>
            <span class="challenge-card-role">${item.role || 'Frontend Engineer'}</span>
          </div>
          <div class="challenge-card-body">
            <p class="challenge-question-text">
              ${item.question}
            </p>
            ${solutionHtml}
          </div>
          <div class="challenge-card-footer">
            <span>Source: <a href="#" class="challenge-card-source-link" onclick="openArticleByTitle('${item.source_title.replace(/'/g, "\\'")}'); return false;">${item.source_title}</a></span>
          </div>
        `;
        container.appendChild(itemEl);
      });
    } else {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px; font-size: 13px;">No specific questions found for this topic yet. Run a feed sync to discover more.</div>`;
    }
  }

  // Populate the 4 challenges list elements
  populateCategoryChallenges('react-challenges', q => q.category === 'React');
  populateCategoryChallenges('javascript-challenges', q => q.category === 'JavaScript (Core)');
  populateCategoryChallenges('css-challenges', q => q.category === 'CSS & HTML');
  populateCategoryChallenges('algorithms-challenges', q => 
    q.category === 'Algorithms & Data Structures' || 
    q.category === 'System Design & Architecture' || 
    q.category === 'General / Other'
  );
}

// Accordion toggle helper
function toggleAccordion(element) {
  const item = element.parentElement;
  const isActive = item.classList.contains('active');
  
  // Close all other items
  document.querySelectorAll('.accordion-item').forEach(el => el.classList.remove('active'));
  
  if (!isActive) {
    item.classList.add('active');
  }
}

// Find and open article modal by title (using robust partial matching)
function openArticleByTitle(title) {
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const post = appData.crawled_posts.find(p => {
    const postTitle = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    return postTitle.includes(cleanTitle) || cleanTitle.includes(postTitle);
  });
  if (post) {
    openArticleModal(post);
  } else {
    console.warn(`Article with title matching "${title}" not found.`);
  }
}

// Markdown to HTML custom parser
function parseMarkdownToHTML(markdown) {
  if (!markdown) return '';
  let html = markdown;
  
  // Escape script tags
  html = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '');

  // Fenced Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
    // Escape HTML inside code block
    const escapedCode = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre><div class="code-copy-wrapper"><button class="copy-code-btn" onclick="copyToClipboard(this)">Copy</button></div><code class="language-${lang}">${escapedCode}</code></pre>`;
  });

  // Inline code: `code`
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Blockquotes: > text
  html = html.replace(/^\s*>\s*(.+)/gm, '<blockquote>$1</blockquote>');

  // Headers
  html = html.replace(/^\s*#{6}\s*(.+)/gm, '<h6>$1</h6>');
  html = html.replace(/^\s*#{5}\s*(.+)/gm, '<h5>$1</h5>');
  html = html.replace(/^\s*#{4}\s*(.+)/gm, '<h4>$1</h4>');
  html = html.replace(/^\s*#{3}\s*(.+)/gm, '<h3>$1</h3>');
  html = html.replace(/^\s*#{2}\s*(.+)/gm, '<h2>$1</h2>');
  html = html.replace(/^\s*#{1}\s*(.+)/gm, '<h1>$1</h1>');

  // Bullet Lists
  html = html.replace(/^\s*[\*\-]\s*(.+)/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');

  // Numbered Lists
  html = html.replace(/^\s*\d+\.\s*(.+)/gm, '<ol-item>$1</ol-item>');
  html = html.replace(/((?:<ol-item>.*<\/ol-item>\s*)+)/g, '<ol>$1</ol>');
  html = html.replace(/<ol-item>/g, '<li>').replace(/<\/ol-item>/g, '</li>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');

  // Paragraphs splitting (double newlines)
  const paragraphs = html.split(/\n\s*\n/);
  html = paragraphs.map(p => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<img')) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}

// Copy snippet to clipboard
function copyToClipboard(button) {
  const pre = button.closest('pre');
  const code = pre.querySelector('code');
  navigator.clipboard.writeText(code.innerText).then(() => {
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = 'Copy';
    }, 1500);
  });
}

// Modal handling
function openArticleModal(post) {
  const modal = document.getElementById('modal-overlay');
  
  document.getElementById('modal-title').textContent = post.title;
  document.getElementById('modal-date').textContent = post.date || 'August 2026';
  document.getElementById('modal-role').textContent = post.role || 'Frontend Engineer';
  document.getElementById('modal-salary').textContent = post.salary !== 'N/A' ? ` | Package: ${post.salary}` : '';
  
  // Links
  document.getElementById('modal-original-link').href = post.original_url;
  document.getElementById('modal-freedium-link').href = post.freedium_url;
  
  // Body Content render
  const renderedContent = parseMarkdownToHTML(post.content_markdown);
  document.getElementById('modal-rendered-body').innerHTML = renderedContent;
  
  modal.classList.add('active');
}

function closeModal() {
  const modal = document.getElementById('modal-overlay');
  modal.classList.remove('active');
}

// Switch between Main Navigation Views (Sidebar buttons)
function switchView(viewId) {
  // Update link styles
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  event.currentTarget.classList.add('active');
  
  // Hide all sections
  document.querySelectorAll('.tab-content').forEach(section => section.classList.remove('active'));
  
  // Show target section
  document.getElementById(viewId).classList.add('active');
}

// Switch between Synthesis Sub-Tabs
function switchSynthTab(tabId) {
  // Update buttons
  document.querySelectorAll('.synth-tab-btn').forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');
  
  // Hide all sub-panels
  document.querySelectorAll('.synth-content').forEach(panel => panel.classList.remove('active'));
  
  // Show target panel
  document.getElementById(tabId).classList.add('active');
}

// Handle crawling dynamic post URLs
async function handleCrawlSubmit(event) {
  event.preventDefault();
  
  const urlInput = document.getElementById('crawl-url-input');
  const url = urlInput.value.trim();
  if (!url) return;
  
  const submitBtn = document.getElementById('crawl-submit-btn');
  const consoleLogger = document.getElementById('console-logger');
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="16"></circle></svg> Crawling...`;
  consoleLogger.textContent = `[INFO] Initializing crawl for: ${url}\n[INFO] Contacting local crawler script...\n`;
  
  try {
    const response = await fetch('/api/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });
    
    const result = await response.json();
    if (result.success) {
      consoleLogger.textContent += `\n[SUCCESS] Scraped and compiled article!\n\n=== Crawler stdout ===\n${result.stdout}`;
      urlInput.value = '';
      
      // Reload everything
      await loadData();
    } else {
      consoleLogger.textContent += `\n[ERROR] Crawl failed!\nReason: ${result.error}\nStderr: ${result.stderr || ''}`;
    }
  } catch (error) {
    consoleLogger.textContent += `\n[ERROR] Network error contacting endpoint: ${error.message}`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Run Crawler`;
  }
}

// Trigger Full Database Re-sync
async function runFullSync() {
  const syncBtn = document.getElementById('full-sync-btn');
  const consoleLogger = document.getElementById('console-logger');
  
  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing...';
  consoleLogger.textContent = `[INFO] Starting full feed synchronization...\n[INFO] Checking RSS feeds and seed lists...\n`;
  
  try {
    const response = await fetch('/api/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}) // Empty body runs standard full crawl
    });
    
    const result = await response.json();
    if (result.success) {
      consoleLogger.textContent += `\n[SUCCESS] Full RSS synchronization completed!\n\n=== Crawler stdout ===\n${result.stdout}`;
      await loadData();
    } else {
      consoleLogger.textContent += `\n[ERROR] Sync failed: ${result.error}`;
    }
  } catch (error) {
    consoleLogger.textContent += `\n[ERROR] Server communication error: ${error.message}`;
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = 'Sync Feeds';
  }
}

// Search Input Listener
document.getElementById('search-input')?.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderArticles();
});

// Theme Toggle Helper
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  const lightIcon = document.getElementById('theme-icon-light');
  const darkIcon = document.getElementById('theme-icon-dark');
  
  if (!toggleBtn) return;
  
  // Read theme preference
  const currentTheme = localStorage.getItem('theme') || 'dark';
  
  if (currentTheme === 'light') {
    document.documentElement.classList.add('light-theme');
    lightIcon.style.display = 'block';
    darkIcon.style.display = 'none';
  } else {
    document.documentElement.classList.remove('light-theme');
    lightIcon.style.display = 'none';
    darkIcon.style.display = 'block';
  }
  
  toggleBtn.addEventListener('click', () => {
    const isLight = document.documentElement.classList.contains('light-theme');
    if (isLight) {
      document.documentElement.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
      lightIcon.style.display = 'none';
      darkIcon.style.display = 'block';
    } else {
      document.documentElement.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
      lightIcon.style.display = 'block';
      darkIcon.style.display = 'none';
    }
  });
}

// App Entry Point
window.addEventListener('DOMContentLoaded', () => {
  loadData();
  initTheme();
});
