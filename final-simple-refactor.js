// Final refactor: two parallel branches, no sub-loop.
//
// Removes 7 pre-processing nodes added today.
// Adds 7 simpler nodes:
//   Parallel branch A (careers persist):
//     - Compute New Careers JDs (Code)
//     - Insert Careers Row (HTTP, multi-item, terminal)
//   Main branch (per-candidate generate, like before today):
//     - IF No JD Match (IF)
//     - GPT Generate JD (HTTP)
//     - Parse Generated JD (Code)
//     - Insert New JD Row (HTTP)
//     - Restore Candidate Data (Code)
//
// Wiring:
//   Fetch Careers JDs ──→ Compute New Careers JDs ──→ Insert Careers Row [terminal]
//                    │
//                    └──→ Fetch Candidates → Filter & Normalize → Loop Over Items
//                                                                       │
//                                                                       ▼
//                                                              Find Best JD Match → IF No JD Match
//                                                                                       ├─TRUE → Generate → Parse → Insert → Restore → Already Extracted?
//                                                                                       └─FALSE → Already Extracted?

const fs = require('fs');
const SRC = 'c:/Users/charulatha.k/Documents/my_app/n8n-workflows/resume-screening-full-pipeline.json';
const j = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const NOCODB_URL = 'https://answermagic.5cn.co.in/api/v1/db/data/noco/pg0zrubkir773po/meqbnjh4qzk29i2';

// 1) Remove pre-processing nodes from today
const toRemove = new Set([
  'Compute JD Work List',
  'Loop JD Work',
  'IF Needs Generation',
  'IF Is Skip',
  'GPT Generate JD',
  'Parse Generated JD',
  'Insert JD Row',
  'Restore Candidates'
]);
const before = j.nodes.length;
j.nodes = j.nodes.filter(n => !toRemove.has(n.name));
for (const name of toRemove) delete j.connections[name];
for (const k of Object.keys(j.connections)) {
  j.connections[k].main = (j.connections[k].main || []).map(branch =>
    branch.filter(l => !toRemove.has(l.node))
  );
}

// 2) Revert Find Best JD Match jsCode — strip the pre-process block
const findBest = j.nodes.find(n => n.name === 'Find Best JD Match');
findBest.parameters.jsCode = findBest.parameters.jsCode.replace(
  /\n\/\/ Also include JDs added in this run via the pre-process sub-loop\.[\s\S]*?\} catch \(e\) \{\}\n\n/,
  ''
);

// 3) Filter & Normalize → Loop Over Items (revert to clean)
j.connections['Filter & Normalize'] = { main: [[{ node: 'Loop Over Items', type: 'main', index: 0 }]] };

// 4) Add new nodes ---------------------------------------------------

const computeNewCareersNode = {
  parameters: {
    mode: 'runOnceForAllItems',
    jsCode: `// Dedup careers JDs vs existing NocoDB list. Emit one item per NEW JD.
const careers = (($input.first() && $input.first().json && $input.first().json.list) || []);
const existing = (($('List All JDs').first() && $('List All JDs').first().json && $('List All JDs').first().json.list) || []);
const have = new Set(existing.map(j => (j.Position || '').trim().toLowerCase()).filter(Boolean));
const newOnes = careers.filter(jd => {
  const title = (jd.Position || '').trim();
  return title && !have.has(title.toLowerCase());
});
return newOnes.map(jd => ({
  json: {
    Position: (jd.Position || '').trim(),
    'Job Description': jd['Job Description'] || ''
  }
}));`
  },
  id: 'f1000000-0000-0000-0000-000000000060',
  name: 'Compute New Careers JDs',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1020, 200]
};

const insertCareersNode = {
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
    jsonBody: '={\n  "Position": {{ JSON.stringify($json.Position) }},\n  "Job Description": {{ JSON.stringify($json["Job Description"]) }}\n}',
    options: {}
  },
  id: 'f1000000-0000-0000-0000-000000000061',
  name: 'Insert Careers Row',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [1240, 200],
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 2000,
  continueOnFail: true
};

const ifNoMatchNode = {
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      conditions: [
        {
          id: 'no-jd-match',
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
    jsonBody: `={\n  "model": "gpt-4.1-mini",\n  "max_tokens": 1500,\n  "messages": [\n    {\n      "role": "user",\n      "content": {{ JSON.stringify('You are writing a Job Description for the role \\"' + ($('Find Best JD Match').item.json.position || '') + '\\" at 5C Network — a Bangalore-based teleradiology and medical-imaging AI company. They handle millions of radiology scans per year, run their own PACS/RIS infrastructure, integrate via DICOM/HL7. Engineering uses TypeScript, Python, PyTorch on AWS. Sales targets hospitals, diagnostic chains, and government health programs.\\\\n\\\\nGuess a sensible experience level from the role title (intern = 0 yrs; \\"senior/principal\\" in the title = 5-10 yrs; everything else = 1-5 yrs).\\\\n\\\\nWrite a complete plain-text Job Description with these sections in this order:\\\\n- About the role (2-3 sentences)\\\\n- Responsibilities (5-7 bullets, prefixed with \\"- \\")\\\\n- Requirements (5-7 bullets, prefixed with \\"- \\")\\\\n- Nice to have (3-4 bullets, prefixed with \\"- \\")\\\\n- Tech stack or domain knowledge expected (1 paragraph)\\\\n\\\\nCRITICAL: Output plain text only. No markdown headers (no #, no **). No code fences. Do NOT include any [AUTO-GENERATED] tag or meta-text. Begin directly with the About the role content.') }}\n    }\n  ]\n}`,
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
return { json: { ...c, jd_text: jdText, matched_position: c.position, match_source: 'generated' } };`
  },
  id: 'f1000000-0000-0000-0000-000000000043',
  name: 'Parse Generated JD',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2000, 250],
  continueOnFail: true
};

const insertNewJDNode = {
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

const restoreNode = {
  parameters: {
    mode: 'runOnceForEachItem',
    jsCode: `return $('Parse Generated JD').item;`
  },
  id: 'f1000000-0000-0000-0000-000000000045',
  name: 'Restore Candidate Data',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2440, 250]
};

j.nodes.push(
  computeNewCareersNode,
  insertCareersNode,
  ifNoMatchNode,
  gptGenNode,
  parseGenNode,
  insertNewJDNode,
  restoreNode
);

// 5) Wire ----------------------------------------------------

// Fetch Careers JDs → BOTH Compute New Careers JDs AND Fetch Candidates (parallel branches)
j.connections['Fetch Careers JDs'] = {
  main: [[
    { node: 'Compute New Careers JDs', type: 'main', index: 0 },
    { node: 'Fetch Candidates', type: 'main', index: 0 }
  ]]
};

// Compute New Careers JDs → Insert Careers Row (terminal)
j.connections['Compute New Careers JDs'] = {
  main: [[{ node: 'Insert Careers Row', type: 'main', index: 0 }]]
};

// Insert Careers Row has no downstream (terminal)

// Find Best JD Match → IF No JD Match
j.connections['Find Best JD Match'] = {
  main: [[{ node: 'IF No JD Match', type: 'main', index: 0 }]]
};

// IF No JD Match
j.connections['IF No JD Match'] = {
  main: [
    [{ node: 'GPT Generate JD', type: 'main', index: 0 }],
    [{ node: 'Already Extracted?', type: 'main', index: 0 }]
  ]
};

j.connections['GPT Generate JD'] = { main: [[{ node: 'Parse Generated JD', type: 'main', index: 0 }]] };
j.connections['Parse Generated JD'] = { main: [[{ node: 'Insert New JD Row', type: 'main', index: 0 }]] };
j.connections['Insert New JD Row'] = { main: [[{ node: 'Restore Candidate Data', type: 'main', index: 0 }]] };
j.connections['Restore Candidate Data'] = { main: [[{ node: 'Already Extracted?', type: 'main', index: 0 }]] };

fs.writeFileSync(SRC, JSON.stringify(j, null, 2));

console.log('Total nodes now:', j.nodes.length, '(was', before + ')');
console.log();
console.log('Careers persist branch (parallel):');
['Compute New Careers JDs','Insert Careers Row'].forEach(n => {
  console.log('  ' + (j.nodes.find(x => x.name === n) ? '✓' : '✗') + ' ' + n);
});
console.log();
console.log('Per-candidate generate (main branch):');
['IF No JD Match','GPT Generate JD','Parse Generated JD','Insert New JD Row','Restore Candidate Data'].forEach(n => {
  console.log('  ' + (j.nodes.find(x => x.name === n) ? '✓' : '✗') + ' ' + n);
});
console.log();
console.log('Fetch Careers JDs goes to TWO branches:', j.connections['Fetch Careers JDs'].main[0].length === 2);
console.log('Find Best JD Match clean of pre-process refs:',
  !findBest.parameters.jsCode.includes("Compute JD Work List"));
