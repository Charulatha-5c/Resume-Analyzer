// Adds JD generation flow to the full pipeline:
//   1. Persist New Careers JDs   — after Fetch Careers JDs, upserts new JDs into NocoDB (dedup by Position)
//   2. IF No JD Match            — after Find Best JD Match, routes unmatched candidates to generate path
//   3. GPT Generate JD           — calls OpenAI to generate a JD for the candidate's role
//   4. Parse Generated JD        — extracts text + attaches to candidate data
//   5. Insert New JD Row         — saves generated JD to NocoDB
//
// Rewires:
//   Fetch Careers JDs → Persist New Careers JDs → Fetch Candidates  (was: Fetch Careers JDs → Fetch Candidates)
//   Find Best JD Match → IF No JD Match                              (was: → Already Extracted?)
//   IF No JD Match TRUE  → GPT Generate JD → Parse Generated JD → Insert New JD Row → Already Extracted?
//   IF No JD Match FALSE → Already Extracted?

const fs = require('fs');
const SRC = 'c:/Users/charulatha.k/Documents/my_app/n8n-workflows/resume-screening-full-pipeline.json';
const j = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const NOCODB_BASE = 'https://answermagic.5cn.co.in';
const NOCODB_JD_TABLE = 'meqbnjh4qzk29i2';  // existing Job Descriptions table

// ----- 1. Persist New Careers JDs -----
const persistNode = {
  parameters: {
    mode: 'runOnceForAllItems',
    jsCode: `// Upsert careers-page JDs into NocoDB JD table. Dedup by Position (case-insensitive).
const careers = (($('Fetch Careers JDs').first().json.list) || []);
const existing = (($('List All JDs').first().json.list) || []);
const have = new Set(existing.map(j => (j.Position || '').trim().toLowerCase()).filter(Boolean));

let inserted = 0;
let failed = 0;
const skipped = [];
const insertedTitles = [];

for (const jd of careers) {
  const title = (jd.Position || '').trim();
  if (!title) continue;
  if (have.has(title.toLowerCase())) { skipped.push(title); continue; }
  try {
    await this.helpers.httpRequest({
      method: 'POST',
      url: '${NOCODB_BASE}/api/v1/db/data/noco/pg0zrubkir773po/${NOCODB_JD_TABLE}',
      headers: {
        'xc-token': $env.NOCODB_TOKEN,
        'content-type': 'application/json'
      },
      body: { Position: title, 'Job Description': jd['Job Description'] || '' },
      json: true
    });
    inserted++;
    insertedTitles.push(title);
    have.add(title.toLowerCase());
  } catch (e) {
    failed++;
  }
}

// Pass careers list forward unchanged (downstream nodes already read it via cross-node refs).
return [{ json: { list: careers, _persist: { inserted, failed, skipped: skipped.length, insertedTitles } } }];`
  },
  id: 'f1000000-0000-0000-0000-000000000040',
  name: 'Persist New Careers JDs',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [850, 250],
  continueOnFail: true
};

// ----- 2. IF No JD Match -----
const ifNoMatchNode = {
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      conditions: [
        {
          id: 'no-jd-match-cond',
          leftValue: "={{ ($('Find Best JD Match').item.json.matched_position || '').toString().trim().length === 0 }}",
          rightValue: true,
          operator: { type: 'boolean', operation: 'true', singleValue: true }
        }
      ],
      combinator: 'and'
    },
    options: {}
  },
  id: 'f1000000-0000-0000-0000-000000000041',
  name: 'IF No JD Match',
  type: 'n8n-nodes-base.if',
  typeVersion: 2,
  position: [1560, 400]
};

// ----- 3. GPT Generate JD -----
const generateJDPrompt = `You are writing a Job Description for the role "' + ($('Find Best JD Match').item.json.position || '') + '" at 5C Network — a Bangalore-based teleradiology and medical-imaging AI company. They handle millions of radiology scans per year, run their own PACS/RIS infrastructure, integrate via DICOM/HL7. Engineering uses TypeScript, Python, PyTorch on AWS. Sales targets hospitals, diagnostic chains, and government health programs.\\n\\nGuess a sensible experience level from the role title (intern = 0 yrs; "senior/principal" in the title = 5-10 yrs; everything else = 1-5 yrs).\\n\\nWrite a complete plain-text Job Description with these sections in this order:\\n- About the role (2-3 sentences)\\n- Responsibilities (5-7 bullets, prefixed with "- ")\\n- Requirements (5-7 bullets, prefixed with "- ")\\n- Nice to have (3-4 bullets, prefixed with "- ")\\n- Tech stack or domain knowledge expected (1 paragraph)\\n\\nCRITICAL: Output plain text only. No markdown headers (no #, no **). No code fences. Do NOT include any [AUTO-GENERATED] tag or meta-text. Begin directly with the About the role content.`;

const gptGenerateNode = {
  parameters: {
    method: 'POST',
    url: 'https://api.openai.com/v1/chat/completions',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'Authorization', value: '=Bearer {{ $env.OPENAI_API_KEY }}' },
        { name: 'content-type', value: 'application/json' }
      ]
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={\n  "model": "gpt-4.1-mini",\n  "max_tokens": 1500,\n  "messages": [\n    {\n      "role": "user",\n      "content": {{ JSON.stringify('${generateJDPrompt}') }}\n    }\n  ]\n}`,
    options: {}
  },
  id: 'f1000000-0000-0000-0000-000000000042',
  name: 'GPT Generate JD',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [1780, 250],
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 2000,
  continueOnFail: true
};

// ----- 4. Parse Generated JD -----
const parseGenNode = {
  parameters: {
    mode: 'runOnceForEachItem',
    jsCode: `const resp = $json;
const c = $('Find Best JD Match').item.json;
const raw = resp && resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content;
let jdText;
if (!raw) {
  jdText = 'Position: ' + (c.position || 'unknown') + '. (Auto-generated JD failed; placeholder. Recruiter to review.) Generic responsibilities and 1-5 years of relevant experience expected.';
} else {
  jdText = String(raw).trim();
  if (jdText.startsWith('[AUTO-GENERATED]')) jdText = jdText.slice('[AUTO-GENERATED]'.length).trim();
  if (!jdText) jdText = 'Position: ' + (c.position || 'unknown') + '. Generic role at 5C Network.';
}
// Attach the generated JD to the candidate data so downstream nodes see it.
return { json: { ...c, jd_text: jdText, matched_position: c.position, match_source: 'generated' } };`
  },
  id: 'f1000000-0000-0000-0000-000000000043',
  name: 'Parse Generated JD',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2000, 250],
  continueOnFail: true
};

// ----- 5. Insert New JD Row -----
const insertJDNode = {
  parameters: {
    method: 'POST',
    url: `${NOCODB_BASE}/api/v1/db/data/noco/pg0zrubkir773po/${NOCODB_JD_TABLE}`,
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'xc-token', value: '={{ $env.NOCODB_TOKEN }}' },
        { name: 'content-type', value: 'application/json' }
      ]
    },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={\n  "Position": {{ JSON.stringify($json.position) }},\n  "Job Description": {{ JSON.stringify($json.jd_text) }}\n}',
    options: {}
  },
  id: 'f1000000-0000-0000-0000-000000000044',
  name: 'Insert New JD Row',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [2220, 250],
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 2000,
  continueOnFail: true
};

// Add the 5 new nodes
j.nodes.push(persistNode, ifNoMatchNode, gptGenerateNode, parseGenNode, insertJDNode);

// ----- Rewire connections -----
const conns = j.connections;

// Old: Fetch Careers JDs → Fetch Candidates
// New: Fetch Careers JDs → Persist New Careers JDs → Fetch Candidates
conns['Fetch Careers JDs'] = { main: [[{ node: 'Persist New Careers JDs', type: 'main', index: 0 }]] };
conns['Persist New Careers JDs'] = { main: [[{ node: 'Fetch Candidates', type: 'main', index: 0 }]] };

// Old: Find Best JD Match → Already Extracted?
// New: Find Best JD Match → IF No JD Match
conns['Find Best JD Match'] = { main: [[{ node: 'IF No JD Match', type: 'main', index: 0 }]] };

// IF No JD Match: TRUE → GPT Generate JD ; FALSE → Already Extracted?
conns['IF No JD Match'] = {
  main: [
    [{ node: 'GPT Generate JD', type: 'main', index: 0 }],
    [{ node: 'Already Extracted?', type: 'main', index: 0 }]
  ]
};

// GPT Generate JD → Parse Generated JD → Insert New JD Row → Already Extracted?
conns['GPT Generate JD'] = { main: [[{ node: 'Parse Generated JD', type: 'main', index: 0 }]] };
conns['Parse Generated JD'] = { main: [[{ node: 'Insert New JD Row', type: 'main', index: 0 }]] };
conns['Insert New JD Row'] = { main: [[{ node: 'Already Extracted?', type: 'main', index: 0 }]] };

fs.writeFileSync(SRC, JSON.stringify(j, null, 2));

console.log('Done.');
console.log('Total nodes now:', j.nodes.length);
console.log();
console.log('New nodes:');
['Persist New Careers JDs','IF No JD Match','GPT Generate JD','Parse Generated JD','Insert New JD Row'].forEach(n => {
  console.log('  ✓ ' + n + (j.nodes.find(x => x.name === n) ? '' : ' (MISSING!)'));
});
