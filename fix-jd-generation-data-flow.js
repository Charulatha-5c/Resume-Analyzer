// Fix data-flow bug in the generate-JD path:
//   1. Add "Restore Candidate Data" node after Insert New JD Row
//   2. Change Use Existing Extraction to read $json instead of cross-ref to Find Best JD Match
//   3. Change Has JD Match? condition to check $json.jd_text instead of cross-ref to Find Best JD Match

const fs = require('fs');
const SRC = 'c:/Users/charulatha.k/Documents/my_app/n8n-workflows/resume-screening-full-pipeline.json';
const j = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// 1) Add Restore Candidate Data node
const restoreNode = {
  parameters: {
    mode: 'runOnceForEachItem',
    jsCode: `// Insert New JD Row outputs the NocoDB POST response.
// Re-emit Parse Generated JD's candidate data so downstream sees jd_text + matched_position.
return $('Parse Generated JD').item;`
  },
  id: 'f1000000-0000-0000-0000-000000000045',
  name: 'Restore Candidate Data',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2440, 250]
};
j.nodes.push(restoreNode);

// 2) Rewire: Insert New JD Row → Restore Candidate Data → Already Extracted?
j.connections['Insert New JD Row'] = {
  main: [[{ node: 'Restore Candidate Data', type: 'main', index: 0 }]]
};
j.connections['Restore Candidate Data'] = {
  main: [[{ node: 'Already Extracted?', type: 'main', index: 0 }]]
};

// 3) Update Use Existing Extraction to read from $json (immediate predecessor)
const useExist = j.nodes.find(n => n.name === 'Use Existing Extraction');
useExist.parameters.jsCode = `// Use existing extracted resume — skip PDF/GPT extraction.
// Read from $json so we get the upstream candidate data (whether it came via FALSE-branch
// of IF No JD Match or via the generate path through Restore Candidate Data).
const c = $json;
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
  matched_position: c.matched_position || '',
  match_source: c.match_source || '',
  extracted_resume_obj: parsed,
  extracted_resume_str: JSON.stringify(parsed, null, 2),
  extraction_error: null,
  used_existing: true
}};`;

// 4) Update Has JD Match? condition — check $json.jd_text instead of cross-ref
const hasJDMatch = j.nodes.find(n => n.name === 'Has JD Match?');
hasJDMatch.parameters.conditions.conditions[0].leftValue = "={{ ($json.jd_text || '').toString().trim().length > 0 }}";

fs.writeFileSync(SRC, JSON.stringify(j, null, 2));

console.log('Done.');
console.log('Total nodes now:', j.nodes.length);
console.log();
console.log('Verifications:');
console.log('  Restore Candidate Data exists:', !!j.nodes.find(n => n.name === 'Restore Candidate Data'));
console.log('  Insert New JD Row → Restore Candidate Data:',
  JSON.stringify(j.connections['Insert New JD Row'].main[0]));
console.log('  Restore Candidate Data → Already Extracted?:',
  JSON.stringify(j.connections['Restore Candidate Data'].main[0]));
console.log('  Use Existing Extraction reads $json:',
  useExist.parameters.jsCode.includes('const c = $json'));
console.log('  Has JD Match? condition:', hasJDMatch.parameters.conditions.conditions[0].leftValue);
