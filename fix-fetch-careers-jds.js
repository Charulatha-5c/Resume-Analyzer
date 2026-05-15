// Fixes Fetch Careers JDs node: replaces native fetch() (not available on older Node)
// with this.helpers.httpRequest (n8n built-in, works on all versions).

const fs = require('fs');
const SRC = 'c:/Users/charulatha.k/Documents/my_app/n8n-workflows/resume-screening-full-pipeline.json';

const j = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const node = j.nodes.find(n => n.name === 'Fetch Careers JDs');
if (!node) { console.error('Node not found'); process.exit(1); }

node.parameters.jsCode = `// Scrape 5C Network careers page using n8n http helper (works on all Node versions).
const ua = 'Mozilla/5.0';
const helpers = this.helpers;

async function fetchHtml(url) {
  try {
    return await helpers.httpRequest({
      method: 'GET',
      url: url,
      headers: { 'User-Agent': ua }
    });
  } catch (e) {
    return '';
  }
}

const careersHtml = await fetchHtml('https://www.5cnetwork.com/careers');
if (!careersHtml) return [{ json: { list: [] } }];

const ldRe = /<script[^>]*type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi;
const ldMatches = careersHtml.match(ldRe) || [];
let jobUrls = [];
for (const m of ldMatches) {
  const jsonStr = m.replace(/<script[^>]*>|<\\/script>/g, '');
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed['@type'] === 'ItemList' && Array.isArray(parsed.itemListElement) && parsed.itemListElement.length > 0) {
      jobUrls = parsed.itemListElement.map(it => (it.item || it).url).filter(Boolean);
      break;
    }
  } catch (e) {}
}

const jobs = await Promise.all(jobUrls.map(async (url) => {
  const html = await fetchHtml(url);
  if (!html) return null;
  const matches = html.match(/<script[^>]*type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi) || [];
  for (const m of matches) {
    const jsonStr = m.replace(/<script[^>]*>|<\\/script>/g, '');
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed['@type'] === 'JobPosting') {
        const desc = String(parsed.description || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\\s+/g, ' ')
          .trim();
        return { Position: parsed.title || '', 'Job Description': desc };
      }
    } catch (e) {}
  }
  return null;
}));

return [{ json: { list: jobs.filter(Boolean) } }];`;

fs.writeFileSync(SRC, JSON.stringify(j, null, 2));
console.log('Done. Code length:', node.parameters.jsCode.length, 'chars');
