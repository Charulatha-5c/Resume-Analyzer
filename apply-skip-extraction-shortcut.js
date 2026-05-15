// Adds a "skip extraction if already done" shortcut to the full pipeline.
//
// New flow:
//   Find Best JD Match → Already Extracted?
//     TRUE  → Use Existing Extraction ────────────────┐
//                                                     ↓
//                                                Has JD Match? → GPT Score → Parse Score → Update → Loop
//                                                     ↑
//     FALSE → Route → ... → Parse Extraction →┐       │
//                                             ├─→ Save Extracted Resume → Carry Extraction Forward →┘
//                                             │   (terminal — write only)
//
// Modifies in place: n8n-workflows/resume-screening-full-pipeline.json

const fs = require('fs');
const SRC = 'c:/Users/charulatha.k/Documents/my_app/n8n-workflows/resume-screening-full-pipeline.json';

const j = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// ---------- 1. Filter & Normalize: pass existing_extracted_resume through ----------
const filterNorm = j.nodes.find(n => n.name === 'Filter & Normalize');
if (filterNorm) {
  filterNorm.parameters.jsCode = filterNorm.parameters.jsCode.replace(
    "link_type: link.type\n    }",
    "link_type: link.type,\n      existing_extracted_resume: r['extracted resume'] || null\n    }"
  );
}

// ---------- 2. Add "Already Extracted?" IF node ----------
const alreadyExtractedNode = {
  parameters: {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'loose'
      },
      conditions: [
        {
          id: 'already-extracted-cond',
          leftValue: "={{ ($('Find Best JD Match').item.json.existing_extracted_resume || '').toString().trim().length > 10 }}",
          rightValue: true,
          operator: {
            type: 'boolean',
            operation: 'true',
            singleValue: true
          }
        }
      ],
      combinator: 'and'
    },
    options: {}
  },
  id: 'f1000000-0000-0000-0000-000000000032',
  name: 'Already Extracted?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2,
  position: [2180, 400]
};

// ---------- 3. Add "Use Existing Extraction" code node ----------
const useExistingNode = {
  parameters: {
    mode: 'runOnceForEachItem',
    jsCode: `// Use the resume already saved on the candidate row — skip PDF fetch + GPT extraction.
const c = $('Find Best JD Match').item.json;
let parsed;
try {
  parsed = JSON.parse(c.existing_extracted_resume);
  if (!parsed || typeof parsed !== 'object') {
    parsed = { error: 'invalid_existing', summary: 'Existing extracted resume parsed but not an object.' };
  }
} catch (e) {
  parsed = { error: 'parse_failed', summary: 'Could not parse existing extracted resume JSON.' };
}
return { json: {
  candidate_id: c.candidate_id,
  position: c.position,
  cover_letter: c.cover_letter || '',
  jd_text: c.jd_text || '',
  extracted_resume_obj: parsed,
  extracted_resume_str: JSON.stringify(parsed, null, 2),
  extraction_error: null,
  used_existing: true
}};`
  },
  id: 'f1000000-0000-0000-0000-000000000033',
  name: 'Use Existing Extraction',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2400, 200]
};

// ---------- 4. Add "Carry Extraction Forward" — restores Parse Extraction data after Save ----------
const carryForwardNode = {
  parameters: {
    mode: 'runOnceForEachItem',
    jsCode: `// Save Extracted Resume returns NocoDB's PATCH response.
// We want Parse Extraction's data to keep flowing downstream so GPT Score has it.
return $('Parse Extraction').item;`
  },
  id: 'f1000000-0000-0000-0000-000000000034',
  name: 'Carry Extraction Forward',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [3760, 560]
};

// Insert the three new nodes
j.nodes.push(alreadyExtractedNode, useExistingNode, carryForwardNode);

// ---------- 5. Rewire connections ----------
const conns = j.connections;

// Find Best JD Match no longer goes straight to Route By Link Type — it goes to Already Extracted?
conns['Find Best JD Match'] = {
  main: [[{ node: 'Already Extracted?', type: 'main', index: 0 }]]
};

// Already Extracted?: TRUE → Use Existing Extraction, FALSE → Route By Link Type
conns['Already Extracted?'] = {
  main: [
    [{ node: 'Use Existing Extraction', type: 'main', index: 0 }],
    [{ node: 'Route By Link Type',      type: 'main', index: 0 }]
  ]
};

// Use Existing Extraction → Has JD Match?
conns['Use Existing Extraction'] = {
  main: [[{ node: 'Has JD Match?', type: 'main', index: 0 }]]
};

// Save Extracted Resume → Carry Extraction Forward (was: → Has JD Match?)
conns['Save Extracted Resume'] = {
  main: [[{ node: 'Carry Extraction Forward', type: 'main', index: 0 }]]
};

// Carry Extraction Forward → Has JD Match?
conns['Carry Extraction Forward'] = {
  main: [[{ node: 'Has JD Match?', type: 'main', index: 0 }]]
};

// ---------- 6. GPT Score: change Parse Extraction refs to Has JD Match? ----------
// Has JD Match? is upstream of GPT Score for BOTH branches and preserves item data (IF nodes don't mutate).
const gptScore = j.nodes.find(n => n.name === 'GPT Score');
if (gptScore) {
  gptScore.parameters.jsonBody = gptScore.parameters.jsonBody.replace(
    /\$\('Parse Extraction'\)\.item\.json/g,
    "$('Has JD Match?').item.json"
  );
}

// ---------- 7. Parse Score: same swap ----------
const parseScore = j.nodes.find(n => n.name === 'Parse Score');
if (parseScore) {
  parseScore.parameters.jsCode = parseScore.parameters.jsCode.replace(
    /\$\('Parse Extraction'\)\.item\.json/g,
    "$('Has JD Match?').item.json"
  );
}

fs.writeFileSync(SRC, JSON.stringify(j, null, 2));

console.log('✓ Updated:', SRC);
console.log('  Total nodes:', j.nodes.length);
console.log('  New nodes added:');
console.log('    • Already Extracted?       (IF)');
console.log('    • Use Existing Extraction  (Code)');
console.log('    • Carry Extraction Forward (Code)');
console.log();
console.log('  Filter & Normalize passes existing_extracted_resume:',
  filterNorm && filterNorm.parameters.jsCode.includes('existing_extracted_resume'));
console.log('  GPT Score refs Has JD Match?:',
  gptScore && gptScore.parameters.jsonBody.includes("$('Has JD Match?').item.json"));
console.log('  Parse Score refs Has JD Match?:',
  parseScore && parseScore.parameters.jsCode.includes("$('Has JD Match?').item.json"));
