// Refactor: pre-process all JD work (seed careers + generate missing) BEFORE the candidate loop.
//
// Removes 6 nodes:
//   - Persist New Careers JDs (Code node — env access broken)
//   - IF No JD Match
//   - GPT Generate JD (per-candidate)
//   - Parse Generated JD (per-candidate)
//   - Insert New JD Row (per-candidate)
//   - Restore Candidate Data
//
// Adds 7 nodes (all in pre-process sub-loop):
//   - Compute JD Work List          (Code — gathers missing JDs)
//   - Loop JD Work                  (SplitInBatches batchSize 1)
//   - IF Needs Generation           (IF)
//   - GPT Generate JD               (HTTP — OpenAI)
//   - Parse Generated JD            (Code — extract text)
//   - Insert JD Row                 (HTTP — NocoDB POST)
//   - Restore Candidates            (Code — re-emit Filter & Normalize items)
//
// Modifies Find Best JD Match: also reads from Compute JD Work List + Parse Generated JD.

const fs = require('fs');
const SRC = 'c:/Users/charulatha.k/Documents/my_app/n8n-workflows/resume-screening-full-pipeline.json';
const j = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const NOCODB_URL = 'https://answermagic.5cn.co.in/api/v1/db/data/noco/pg0zrubkir773po/meqbnjh4qzk29i2';

// 1. REMOVE OLD NODES ------------------------------------------------------
const toRemove = new Set([
  'Persist New Careers JDs',
  'IF No JD Match',
  'GPT Generate JD',
  'Parse Generated JD',
  'Insert New JD Row',
  'Restore Candidate Data'
]);

j.nodes = j.nodes.filter(n => !toRemove.has(n.name));
for (const name of toRemove) delete j.connections[name];
for (const k of Object.keys(j.connections)) {
  j.connections[k].main = (j.connections[k].main || []).map(branch =>
    branch.filter(l => !toRemove.has(l.node))
  );
}

// 2. RESTORE WIRING BEFORE ADDING NEW NODES --------------------------------
// Fetch Careers JDs should now go directly to Fetch Candidates
j.connections['Fetch Careers JDs'] = { main: [[{ node: 'Fetch Candidates', type: 'main', index: 0 }]] };

// Find Best JD Match should now go directly to Already Extracted?
j.connections['Find Best JD Match'] = { main: [[{ node: 'Already Extracted?', type: 'main', index: 0 }]] };

// 3. ADD NEW NODES --------------------------------------------------------

// 3a. Compute JD Work List
const computeNode = {
  parameters: {
    mode: 'runOnceForAllItems',
    jsCode: `// Computes which JDs need to be added to NocoDB in this run.
// Outputs one item per work unit.
const existingJDs = (($('List All JDs').first().json.list) || []);
const careersJDs = (($('Fetch Careers JDs').first().json.list) || []);
const candidates = $input.all().map(x => x.json || {});

const have = new Set(
  existingJDs.map(j => (j.Position || '').trim().toLowerCase()).filter(Boolean)
);

const work = [];

// (1) Add new careers JDs (not yet in NocoDB)
for (const jd of careersJDs) {
  const title = (jd.Position || '').trim();
  if (!title) continue;
  const key = title.toLowerCase();
  if (have.has(key)) continue;
  work.push({ action: 'insert_careers', position: title, jd_text: jd['Job Description'] || '' });
  have.add(key);
}

// (2) Add unique candidate positions not in NocoDB or careers
const seenInRun = new Set();
for (const c of candidates) {
  const pos = (c.position || '').trim();
  if (!pos) continue;
  const key = pos.toLowerCase();
  if (have.has(key)) continue;
  if (seenInRun.has(key)) continue;
  seenInRun.add(key);
  work.push({ action: 'generate_and_insert', position: pos, jd_text: '' });
  have.add(key);
}

return work.map(w => ({ json: w }));`
  },
  id: 'f1000000-0000-0000-0000-000000000050',
  name: 'Compute JD Work List',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1330, 600]
};

// 3b. Loop JD Work
const loopJDNode = {
  parameters: { batchSize: 1, options: {} },
  id: 'f1000000-0000-0000-0000-000000000051',
  name: 'Loop JD Work',
  type: 'n8n-nodes-base.splitInBatches',
  typeVersion: 3,
  position: [1540, 600]
};

// 3c. IF Needs Generation
const ifGenNode = {
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      conditions: [
        {
          id: 'needs-gen',
          leftValue: "={{ $json.action === 'generate_and_insert' }}",
          rightValue: true,
          operator: { type: 'boolean', operation: 'true', singleValue: true }
        }
      ],
      combinator: 'and'
    },
    options: {}
  },
  id: 'f1000000-0000-0000-0000-000000000052',
  name: 'IF Needs Generation',
  type: 'n8n-nodes-base.if',
  typeVersion: 2,
  position: [1760, 600]
};

// 3d. GPT Generate JD (HTTP, per work item)
const gptGenNode = {
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
    jsonBody: `={\n  "model": "gpt-4.1-mini",\n  "max_tokens": 1500,\n  "messages": [\n    {\n      "role": "user",\n      "content": {{ JSON.stringify('You are writing a Job Description for the role \\"' + $json.position + '\\" at 5C Network — a Bangalore-based teleradiology and medical-imaging AI company. They handle millions of radiology scans per year, run their own PACS/RIS infrastructure, integrate via DICOM/HL7. Engineering uses TypeScript, Python, PyTorch on AWS. Sales targets hospitals, diagnostic chains, and government health programs.\\\\n\\\\nGuess a sensible experience level from the role title (intern = 0 yrs; \\"senior/principal\\" in the title = 5-10 yrs; everything else = 1-5 yrs).\\\\n\\\\nWrite a complete plain-text Job Description with these sections in this order:\\\\n- About the role (2-3 sentences)\\\\n- Responsibilities (5-7 bullets, prefixed with \\"- \\")\\\\n- Requirements (5-7 bullets, prefixed with \\"- \\")\\\\n- Nice to have (3-4 bullets, prefixed with \\"- \\")\\\\n- Tech stack or domain knowledge expected (1 paragraph)\\\\n\\\\nCRITICAL: Output plain text only. No markdown headers (no #, no **). No code fences. Do NOT include any [AUTO-GENERATED] tag or meta-text. Begin directly with the About the role content.') }}\n    }\n  ]\n}`,
    options: {}
  },
  id: 'f1000000-0000-0000-0000-000000000053',
  name: 'GPT Generate JD',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [1980, 480],
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 2000,
  continueOnFail: true
};

// 3e. Parse Generated JD
const parseGenNode = {
  parameters: {
    mode: 'runOnceForEachItem',
    jsCode: `const resp = $json;
const work = $('Loop JD Work').item.json;
const raw = resp && resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content;
let jdText;
if (!raw) {
  jdText = 'Position: ' + (work.position || 'unknown') + '. (Auto-generated JD failed; placeholder. Recruiter to review.) Generic responsibilities and 1-5 years of relevant experience expected.';
} else {
  jdText = String(raw).trim();
  if (jdText.startsWith('[AUTO-GENERATED]')) jdText = jdText.slice('[AUTO-GENERATED]'.length).trim();
  if (!jdText) jdText = 'Position: ' + (work.position || 'unknown') + '. Generic role at 5C Network.';
}
return { json: { action: work.action, position: work.position, jd_text: jdText } };`
  },
  id: 'f1000000-0000-0000-0000-000000000054',
  name: 'Parse Generated JD',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2200, 480]
};

// 3f. Insert JD Row (HTTP)
const insertJDNode = {
  parameters: {
    method: 'POST',
    url: NOCODB_URL,
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
  id: 'f1000000-0000-0000-0000-000000000055',
  name: 'Insert JD Row',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [2420, 600],
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 2000,
  continueOnFail: true
};

// 3g. Restore Candidates
const restoreCandidatesNode = {
  parameters: {
    mode: 'runOnceForAllItems',
    jsCode: `// After all JD work is done, re-emit Filter & Normalize's candidates so Loop Over Items can iterate.
return $('Filter & Normalize').all();`
  },
  id: 'f1000000-0000-0000-0000-000000000056',
  name: 'Restore Candidates',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1760, 780]
};

j.nodes.push(computeNode, loopJDNode, ifGenNode, gptGenNode, parseGenNode, insertJDNode, restoreCandidatesNode);

// 4. WIRE NEW FLOW --------------------------------------------------------

// Filter & Normalize → Compute JD Work List
j.connections['Filter & Normalize'] = { main: [[{ node: 'Compute JD Work List', type: 'main', index: 0 }]] };

// Compute JD Work List → Loop JD Work
j.connections['Compute JD Work List'] = { main: [[{ node: 'Loop JD Work', type: 'main', index: 0 }]] };

// Loop JD Work: main[0] = done, main[1] = batch
j.connections['Loop JD Work'] = {
  main: [
    [{ node: 'Restore Candidates', type: 'main', index: 0 }],   // done
    [{ node: 'IF Needs Generation', type: 'main', index: 0 }]   // batch
  ]
};

// IF Needs Generation: TRUE → GPT Generate JD; FALSE → Insert JD Row
j.connections['IF Needs Generation'] = {
  main: [
    [{ node: 'GPT Generate JD', type: 'main', index: 0 }],
    [{ node: 'Insert JD Row', type: 'main', index: 0 }]
  ]
};

j.connections['GPT Generate JD'] = { main: [[{ node: 'Parse Generated JD', type: 'main', index: 0 }]] };
j.connections['Parse Generated JD'] = { main: [[{ node: 'Insert JD Row', type: 'main', index: 0 }]] };
j.connections['Insert JD Row'] = { main: [[{ node: 'Loop JD Work', type: 'main', index: 0 }]] };

// Restore Candidates → Loop Over Items
j.connections['Restore Candidates'] = { main: [[{ node: 'Loop Over Items', type: 'main', index: 0 }]] };

// 5. MODIFY Find Best JD Match TO INCLUDE FRESH JDS ----------------------
const findBest = j.nodes.find(n => n.name === 'Find Best JD Match');
const oldCode = findBest.parameters.jsCode;

// Find the spot after the existing combined.concat lines and insert our new block before "// Try exact match"
const newBlock = `
// Also include JDs added in this run via the pre-process sub-loop.
try {
  const workItems = ($('Compute JD Work List').all() || []);
  const genItems = ($('Parse Generated JD').all() || []);
  const genMap = new Map();
  for (const it of genItems) {
    const g = it.json || {};
    if (g.position) genMap.set(String(g.position).trim().toLowerCase(), g.jd_text || '');
  }
  for (const it of workItems) {
    const w = it.json || {};
    const p = (w.position || '').trim();
    if (!p) continue;
    let txt = w.jd_text || '';
    if (w.action === 'generate_and_insert') {
      txt = genMap.get(p.toLowerCase()) || txt;
    }
    if (txt) combined.push({ Position: p, 'Job Description': txt });
  }
} catch (e) {}

`;

findBest.parameters.jsCode = oldCode.replace(
  '// Try exact match first (case-insensitive)',
  newBlock + '// Try exact match first (case-insensitive)'
);

if (findBest.parameters.jsCode === oldCode) {
  console.error('WARNING: Could not insert new JDs block into Find Best JD Match!');
}

fs.writeFileSync(SRC, JSON.stringify(j, null, 2));

// VERIFY ------------------------------------------------------------------
const expected = ['Compute JD Work List','Loop JD Work','IF Needs Generation','GPT Generate JD','Parse Generated JD','Insert JD Row','Restore Candidates'];
const removed = ['Persist New Careers JDs','IF No JD Match','Insert New JD Row','Restore Candidate Data'];
console.log('Total nodes now:', j.nodes.length);
console.log();
console.log('Added:');
for (const n of expected) {
  const ok = j.nodes.some(x => x.name === n);
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + n);
}
console.log();
console.log('Removed:');
for (const n of removed) {
  const gone = !j.nodes.some(x => x.name === n);
  console.log('  ' + (gone ? '✓' : '✗') + ' ' + n);
}
console.log();
console.log('Find Best JD Match reads from Compute JD Work List:',
  findBest.parameters.jsCode.includes("$('Compute JD Work List')") ? '✓' : '✗');
