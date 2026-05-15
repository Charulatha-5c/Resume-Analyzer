// Creates a SIMPLIFIED workflow that ONLY does resume extraction (no JD matching, no scoring).
// Reads the existing full pipeline, strips out JD + scoring nodes, writes to a new file.

const fs = require('fs');
const SRC = 'c:/Users/charulatha.k/Documents/my_app/n8n-workflows/resume-screening-full-pipeline.json';
const DST = 'c:/Users/charulatha.k/Documents/my_app/n8n-workflows/resume-extraction-only.json';

const j = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// Nodes to remove (JD matching + scoring)
const toRemove = new Set([
  'List All JDs',
  'Fetch Careers JDs',
  'IF JD Found',
  'GPT Generate JD',
  'Parse Generated JD',
  'Insert New JD Row',
  'Has JD Match?',
  'GPT Score',
  'Parse Score',
  'Update Candidate With Score'
]);

j.nodes = j.nodes.filter(n => !toRemove.has(n.name));

// Rename workflow
j.name = 'Resume Extraction Only';

// Make Find Best JD Match a pure passthrough so downstream nodes don't break
//   (they reference $('Find Best JD Match').item.json for cv_drive_link / position / etc.)
const findBest = j.nodes.find(n => n.name === 'Find Best JD Match');
if (findBest) {
  findBest.parameters.jsCode = `// Passthrough — keep original candidate fields intact so downstream nodes work.\nconst candidate = $json;\nreturn { json: { ...candidate, jd_text: null, matched_position: null, match_source: 'none' } };`;
}

// Rewire connections
const conns = j.connections;

// Remove all connection entries for removed nodes
for (const name of toRemove) delete conns[name];

// New connection chain:
//   Determine Mode → Fetch Candidates   (skips List All JDs + Fetch Careers JDs)
conns['Determine Mode'] = { main: [[{ node: 'Fetch Candidates', type: 'main', index: 0 }]] };

//   Fetch Candidates → Filter & Normalize    (unchanged)
//   Filter & Normalize → Loop Over Items     (unchanged)
//   Loop Over Items → Find Best JD Match     (unchanged)
//   Find Best JD Match → Route By Link Type  (skip IF JD Found, already set this way in source)
conns['Find Best JD Match'] = { main: [[{ node: 'Route By Link Type', type: 'main', index: 0 }]] };

//   Route By Link Type → PDF / LinkedIn / iCloud → ... → Save Extracted Resume (unchanged)
//   Save Extracted Resume → Loop Over Items (loop back; no scoring)
conns['Save Extracted Resume'] = { main: [[{ node: 'Loop Over Items', type: 'main', index: 0 }]] };

// Update Filter & Normalize: relax the "fullyDone" check since there's no LLM score to consider.
//   In extraction-only mode, a candidate is "done" iff extracted resume is non-blank.
const filterNorm = j.nodes.find(n => n.name === 'Filter & Normalize');
if (filterNorm) {
  filterNorm.parameters.jsCode = filterNorm.parameters.jsCode.replace(
    /const fullyDone = hasText\(r\['extracted resume'\]\) && hasNum\(r\['LLM score'\]\) && Number\(r\['LLM score'\]\) > 0;/,
    "const fullyDone = hasText(r['extracted resume']);"
  );
}

// Also relax the Fetch Candidates URL filter: only need "extracted resume blank" (don't care about LLM score)
const fetchC = j.nodes.find(n => n.name === 'Fetch Candidates');
if (fetchC) {
  fetchC.parameters.url = fetchC.parameters.url.replace(
    /\(CreatedAt,gte,exactDate,2025-11-01\)~and\(\(extracted resume,blank\)~or\(\(LLM score,blank\)~or\(LLM score,eq,0\)\)\)/,
    '(CreatedAt,gte,exactDate,2025-11-01)~and(extracted resume,blank)'
  );
}

fs.writeFileSync(DST, JSON.stringify(j, null, 2));

console.log('✓ Created:', DST);
console.log('  Total nodes:', j.nodes.length);
console.log('  Node names:');
j.nodes.forEach(n => console.log('    •', n.name));
console.log();
console.log('  Find Best JD Match is now a passthrough:', findBest && findBest.parameters.jsCode.includes('Passthrough'));
console.log('  Filter & Normalize relaxed fullyDone check:', filterNorm && !filterNorm.parameters.jsCode.includes("Number(r['LLM score']) > 0"));
console.log('  Fetch Candidates filter simplified:', fetchC && !fetchC.parameters.url.includes('LLM score,eq,0'));
