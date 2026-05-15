// One-shot script to update the n8n workflow JSON with:
//   1. New GPT Score prompt (v6, 6-factor)
//   2. New Fetch Careers JDs node (scrapes 5C careers page)
//   3. Find Best JD Match combines careers + NocoDB
//   4. Has JD Match? gate between Save Extracted Resume and GPT Score
//   5. Connections rewired: skip IF JD Found gate, add scoring gate

const fs = require('fs');
const PATH = 'c:/Users/charulatha.k/Documents/my_app/n8n-workflows/resume-screening-full-pipeline.json';
const j = JSON.parse(fs.readFileSync(PATH, 'utf8'));

// =============== V6 SCORING PROMPT ===============
const v6Prompt = `You are a Hiring Manager at 5C Network — a Bangalore-based teleradiology and AI medical-imaging company.

YOUR PERSONA (pick based on the position the candidate applied for):
- Applied Scientist / Data Scientist / ML / Computer Vision / Research → "AI/ML Hiring Manager"
- Software Engineer / Frontend / Backend / DevOps / SRE / Tech Lead → "Engineering Hiring Manager"
- Sales / BD / Account Manager / Sales Manager → "Sales Hiring Manager"
- Radiology Technician / CT Tech / QC / Reporting Analyst / Operations → "Hiring Manager"
- Any other role → "Hiring Manager"

YOU RECEIVE FOUR INPUTS:
(a) the position the candidate applied for
(b) the official Job Description
(c) the candidate cover letter (may be empty)
(d) the parsed JSON resume (skills, total_experience_years, previous_jobs, education, certifications, projects, summary)

ROLE TIER CLASSIFICATION (examples — use judgment for unlisted roles):
- HIGH-TIER: Principal / Senior / Lead / Manager / Director / Architect / Tech Lead / Head of ... → significant ownership, leadership, or deep specialised expertise.
- MID-TIER: Applied Scientist / Data Scientist / ML Engineer / Computer Vision Engineer / Engineer (mid-level) / Software Engineer / Specialist / Senior Analyst → individual contributors with technical depth.
- JUNIOR / OPERATIONS: Intern / Junior / Trainee / Sales / Account Manager / CT Technician / QC / Reporting Analyst / Admin / Support → entry-level, operational, or sales/support.

COMPANY TYPE CLASSIFICATION (factor #1):
A. PRODUCT-BASED — strongly preferred for HIGH-TIER and MID-TIER. MNC or startup doesn't matter.
   Examples: Google, Microsoft, Amazon, Meta, OpenAI, Anthropic, Razorpay, Flipkart, Zomato, PhonePe, Postman, CRED, Stripe, Figma.
B. HEALTHCARE / MEDICAL — strongly preferred for JUNIOR/OPERATIONS, secondary for HIGH-TIER.
   Examples: Philips Healthcare, GE Healthcare, Practo, Tata 1mg, Apollo Hospitals, Qure.ai, SigTuple, Niramai.
C. SERVICE-BASED — neutral / slight negative for technical HIGH-TIER/MID-TIER, neutral for JUNIOR/OPS.
   Examples: TCS, Infosys, Wipro, Cognizant, Accenture, Capgemini.
D. OTHER — relevant only if the role specifically requires that domain expertise.

COLLEGE TIER CLASSIFICATION (factor #2):
- TIER 1: Elite tech + management + medical. Examples: IITs, IISc, BITS Pilani, top IIMs (A/B/C/L/K), AIIMS, CMC Vellore, MIT, Stanford, Cambridge, Oxford.
- TIER 2: Strong but not elite. Examples: Other NITs, IIITs (Hyderabad/Delhi/Bangalore), DTU, NSUT, VIT, COEP, regional IIMs, Manipal, BIT Mesra.
- TIER 3: General. Examples: SRM, KIIT, Amity, LPU, general state universities.

EVALUATION CRITERIA (6 factors, weighted):

1. PREVIOUS COMPANY — 20%
   HIGH-TIER role: PRODUCT-BASED first; HEALTHCARE secondary.
   MID-TIER role: PRODUCT-BASED preferred; HEALTHCARE and SERVICE acceptable.
   JUNIOR / OPERATIONS: HEALTHCARE alignment matters most.
   Score 90-100 for strong match; 50-70 for partial; 20-40 if mostly service-based for a technical role; 0-20 if no relevant prior co.

2. COLLEGE TIER — 20%
   HIGH-TIER: T1 (90+), T2 (70-80), T3 (40-60).
   MID-TIER: T1 (90+), T2 (80+), T3 (60-70).
   JUNIOR / OPERATIONS: T1 (95+), T2 (85+), T3 (75+) — don't significantly penalise.

3. YEARS OF EXPERIENCE — 20%
   Read the JD carefully — it states the expected experience for THIS role.
   Compare candidate.total_experience_years against what the JD asks.
   Best score when years comfortably match/exceed JD minimum; reduce when significantly under or over.

4. SKILLS ALIGNMENT — 20%
   Focus ONLY on the TOP 5-8 MUST-HAVE skills from the JD — not every keyword.
   Match candidate.skills + skills implied by previous_jobs descriptions.
   Reward exact matches; penalise missing must-haves. Don't reward unrelated skills.

5. PREVIOUS JOB ROLE ALIGNMENT — 15%
   Read candidate.previous_jobs[].title and description.
   Have they actually done similar work to what this JD asks?

6. CERTIFICATIONS & PROJECTS — 5%
   candidate.certifications and side projects.
   Reward relevant certs by role family (Cloud: AWS/GCP/Azure/K8s; AI/ML: DeepLearning.AI specs, Kaggle, CVPR/NeurIPS papers; Medical imaging: DICOM, HL7, FDA 510(k), ARRT, RSNA; Finance: CFA, FRM, Six Sigma; Sales: HubSpot, Salesforce).
   Reward personal projects / papers / open-source work related to JD. Ignore unrelated.

COVER LETTER (silent bonus — DO NOT mention in reason):
If cover letter is non-empty AND shows specific motivation/fit, add a small bonus of up to +3 points. Otherwise ignore. DO NOT reference the cover letter in the output reason text.

LIMITATION HANDLING:
If source_link_type = "linkedin" → partial info; score what's available and note the limitation in the reason.
If source_status = "empty" or summary says content was unavailable → score = 0 and reason explaining the resume couldn't be evaluated.

FINAL SCORE = round(0.20·company + 0.20·college + 0.20·experience + 0.20·skills + 0.15·previous_role + 0.05·certs_projects) + cover_letter_bonus, clamped to [0, 100].

OUTPUT FORMAT (strictly JSON, no markdown, no commentary):
{
  "score": <integer 0-100>,
  "reason": "SIX sentences — one per weighted factor (1) Previous company, (2) College tier, (3) Experience, (4) Skills, (5) Previous role, (6) Certifications & projects. Each sentence states the factor name and how the candidate scored. DO NOT mention the cover letter. End with a brief note on source limitations ONLY if applicable (LinkedIn-only / iCloud / unreadable PDF)."
}`;

const promptJsLiteral = JSON.stringify(v6Prompt);

const newScoreBody = `={
  "model": "gpt-4.1-mini",
  "max_tokens": 800,
  "response_format": { "type": "json_object" },
  "messages": [
    {
      "role": "system",
      "content": {{ JSON.stringify(${promptJsLiteral}) }}
    },
    {
      "role": "user",
      "content": {{ JSON.stringify('POSITION APPLIED FOR: ' + ($('Parse Extraction').item.json.position || '') + '\\n\\n---\\n\\nJOB DESCRIPTION:\\n\\n' + ($('Parse Extraction').item.json.jd_text || '') + '\\n\\n---\\n\\nCOVER LETTER:\\n' + (($('Parse Extraction').item.json.cover_letter || '').trim() || '(none provided)') + '\\n\\n---\\n\\nCANDIDATE RESUME (parsed JSON):\\n\\n' + ($('Parse Extraction').item.json.extracted_resume_str || '')) }}
    }
  ]
}`;

j.nodes.find(n => n.name === 'GPT Score').parameters.jsonBody = newScoreBody;
j.nodes.find(n => n.name === 'GPT Score').parameters.options = {};

// =============== ADD "Fetch Careers JDs" NODE ===============
const fetchCareersCode = `// Scrape 5C Network careers page (https://www.5cnetwork.com/careers)
// and fetch each individual job's JSON-LD JobPosting description.
// Returns a single item with json.list of { Position, "Job Description" }.

const ua = 'Mozilla/5.0';

async function fetchJobDescriptions() {
  // 1) Get the careers landing page
  const careersResp = await fetch('https://www.5cnetwork.com/careers', { headers: { 'User-Agent': ua } });
  const careersHtml = await careersResp.text();

  // 2) Find the ItemList JSON-LD that lists open positions
  const ldMatches = careersHtml.match(/<script[^>]*type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi) || [];
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

  // 3) Fetch each job page in parallel and pull JobPosting structured data
  const jobs = await Promise.all(jobUrls.map(async (url) => {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': ua } });
      const html = await r.text();
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
    } catch (e) {}
    return null;
  }));

  return jobs.filter(Boolean);
}

const careersList = await fetchJobDescriptions();
return { json: { list: careersList } };`;

const fetchCareersNode = {
  parameters: {
    mode: "runOnceForAllItems",
    jsCode: fetchCareersCode
  },
  id: "f1000000-0000-0000-0000-000000000030",
  name: "Fetch Careers JDs",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [800, 400],
  continueOnFail: true,
  alwaysOutputData: true
};

if (!j.nodes.find(n => n.name === 'Fetch Careers JDs')) {
  j.nodes.push(fetchCareersNode);
}

// =============== UPDATE Find Best JD Match TO COMBINE LISTS ===============
const findBestNode = j.nodes.find(n => n.name === 'Find Best JD Match');
findBestNode.parameters.jsCode = `const ROLE_SUFFIXES = new Set([
  'engineer','developer','scientist','manager','specialist','analyst',
  'lead','senior','junior','principal','staff','associate',
  'intern','executive','admin','administrator','support',
  'technician','technologist','tester','designer',
  'owner','consultant','representative','rep','officer','assessor'
]);
const STOP = new Set(['the','a','an','of','and','or','in','for','to','with']);

function tokenize(s) {
  return (s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim().split(/\\s+/)
    .filter(w => w.length >= 2)
    .filter(w => !STOP.has(w));
}
function domainTokens(s) {
  return new Set(tokenize(s).filter(w => !ROLE_SUFFIXES.has(w)));
}
function similarity(a, b) {
  const da = domainTokens(a);
  const db = domainTokens(b);
  if (da.size === 0 || db.size === 0) {
    const ta = new Set(tokenize(a));
    const tb = new Set(tokenize(b));
    if (ta.size === 0 || tb.size === 0) return 0;
    const c = [...ta].filter(w => tb.has(w)).length;
    return c / Math.max(ta.size, tb.size);
  }
  const c = [...da].filter(w => db.has(w)).length;
  return c / Math.max(da.size, db.size);
}

const candidate = $json;
const pos = (candidate.position || '').trim();

// Combine careers page JDs (12) + NocoDB JDs (Applied Scientist + others)
let combined = [];
try {
  const careers = ($('Fetch Careers JDs').first().json.list) || [];
  combined = combined.concat(careers);
} catch (e) {}
try {
  const noco = ($('List All JDs').first().json.list) || [];
  combined = combined.concat(noco.filter(j => (j.Position || '').trim().length > 0));
} catch (e) {}

// Try exact match first (case-insensitive)
const exact = combined.find(j => (j.Position || '').trim().toLowerCase() === pos.toLowerCase());
if (exact) {
  return { json: { ...candidate, jd_text: exact['Job Description'] || '', matched_position: exact.Position, match_source: 'exact', similarity: 1 } };
}

// Fuzzy match
const FUZZY_THRESHOLD = 0.5;
const scored = combined.map(j => ({ jd: j, sim: similarity(pos, j.Position) })).sort((a, b) => b.sim - a.sim);
const best = scored[0];
if (best && best.sim >= FUZZY_THRESHOLD) {
  return { json: { ...candidate, jd_text: best.jd['Job Description'] || '', matched_position: best.jd.Position, match_source: 'fuzzy', similarity: best.sim } };
}

// No match — set null so the downstream gate can skip scoring
return { json: { ...candidate, jd_text: null, matched_position: null, match_source: 'none', similarity: 0 } };`;

// =============== ADD "Has JD Match?" IF NODE ===============
const hasJdMatchNode = {
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: "", typeValidation: "loose" },
      conditions: [
        {
          id: "has-jd-match-cond",
          leftValue: "={{ ($('Find Best JD Match').item.json.matched_position || '').toString().trim().length > 0 }}",
          rightValue: true,
          operator: { type: "boolean", operation: "true", singleValue: true }
        }
      ],
      combinator: "and"
    },
    options: {}
  },
  id: "f1000000-0000-0000-0000-000000000031",
  name: "Has JD Match?",
  type: "n8n-nodes-base.if",
  typeVersion: 2,
  position: [3870, 400]
};
if (!j.nodes.find(n => n.name === 'Has JD Match?')) {
  j.nodes.push(hasJdMatchNode);
}

// =============== REWIRE CONNECTIONS ===============
const conns = j.connections;

// 1. Determine Mode → List All JDs → Fetch Careers JDs → Fetch Candidates
conns["Determine Mode"] = { main: [[{ node: "List All JDs", type: "main", index: 0 }]] };
conns["List All JDs"] = { main: [[{ node: "Fetch Careers JDs", type: "main", index: 0 }]] };
conns["Fetch Careers JDs"] = { main: [[{ node: "Fetch Candidates", type: "main", index: 0 }]] };

// 2. Skip "IF JD Found" gate — Find Best JD Match goes directly to Route By Link Type
conns["Find Best JD Match"] = { main: [[{ node: "Route By Link Type", type: "main", index: 0 }]] };

// 3. Disconnect the IF JD Found false → GPT Generate JD path (leave nodes as orphans)
conns["IF JD Found"] = { main: [[{ node: "Route By Link Type", type: "main", index: 0 }], []] };
conns["GPT Generate JD"] = { main: [[]] };
conns["Parse Generated JD"] = { main: [[]] };
conns["Insert New JD Row"] = { main: [[]] };

// 4. Save Extracted Resume → Has JD Match? → (true) GPT Score / (false) Loop Over Items
conns["Save Extracted Resume"] = { main: [[{ node: "Has JD Match?", type: "main", index: 0 }]] };
conns["Has JD Match?"] = {
  main: [
    [{ node: "GPT Score", type: "main", index: 0 }],
    [{ node: "Loop Over Items", type: "main", index: 0 }]
  ]
};
// 5. (Existing) GPT Score → Parse Score → Update Candidate With Score → Loop Over Items (already wired)

// =============== WRITE BACK ===============
fs.writeFileSync(PATH, JSON.stringify(j, null, 2));
console.log('✓ Workflow JSON updated');
console.log('  Total nodes:', j.nodes.length);
console.log('  Has Fetch Careers JDs:', !!j.nodes.find(n => n.name === 'Fetch Careers JDs'));
console.log('  Has "Has JD Match?":', !!j.nodes.find(n => n.name === 'Has JD Match?'));
console.log('  GPT Score prompt v6:', j.nodes.find(n => n.name === 'GPT Score').parameters.jsonBody.includes('SIX sentences'));
