// Mirror the GPT Score prompt edit (made in n8n UI) into the JSON file.
// Uses String.raw to avoid JS escape-character hell.

const fs = require('fs');
const SRC = 'c:/Users/charulatha.k/Documents/my_app/n8n-workflows/resume-screening-full-pipeline.json';

const j = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const node = j.nodes.find(n => n.name === 'GPT Score');
if (!node) { console.error('GPT Score node not found'); process.exit(1); }

const OLD = String.raw`OUTPUT FORMAT (strictly JSON, no markdown, no commentary):\n{\n  \"score\": <integer 0-100>,\n  \"reason\": \"SIX sentences — one per weighted factor (1) Previous company, (2) College tier, (3) Experience, (4) Skills, (5) Previous role, (6) Certifications & projects. Each sentence states the factor name and how the candidate scored. DO NOT mention the cover letter. End with a brief note on source limitations ONLY if applicable (LinkedIn-only / iCloud / unreadable PDF).\"\n}`;

const NEW = String.raw`OUTPUT FORMAT (strictly JSON, no markdown, no commentary):\n{\n  \"score\": <integer 0-100>,\n  \"reason\": \"Six sentences written as a hiring manager's evaluation note. Total length MUST stay under 150 words. One sentence per weighted factor in this exact order: (1) Previous company, (2) College tier, (3) Experience, (4) Skills, (5) Previous role, (6) Certifications & projects.\\n\\nSTYLE RULES:\\n- Each sentence MUST start with an action verb (Brings, Holds, Shows, Demonstrates, Comes from, Carries, Combines, Pairs, Backs up, etc.).\\n- Reference SPECIFIC evidence from the resume: actual company names (e.g. 'Razorpay'), college names (e.g. 'SRM University'), skill names, years, previous job titles. NEVER write generic phrases like 'previous company score is low' or 'experience is significantly below'.\\n- Frame constructively: prefer 'demonstrates strong X with room to grow on Y' over 'lacks Y'. State gaps as scope-stretch or alignment opportunities.\\n- Tone: balanced, professional, sounds like a recruiter's note to a hiring partner — not a checklist.\\n- Keep total length under 150 words. Brevity over completeness.\\n- DO NOT mention the cover letter.\\n\\nEnd with a brief note on source limitations ONLY if applicable (LinkedIn-only / iCloud / unreadable PDF).\"\n}`;

if (!node.parameters.jsonBody.includes(OLD)) {
  console.error('OLD block not found verbatim. Aborting to avoid corruption.');
  console.error('  Has OUTPUT FORMAT:', node.parameters.jsonBody.includes('OUTPUT FORMAT'));
  console.error('  Has SIX sentences:', node.parameters.jsonBody.includes('SIX sentences'));
  console.error('  Has Six sentences written:', node.parameters.jsonBody.includes('Six sentences written'));
  process.exit(1);
}

node.parameters.jsonBody = node.parameters.jsonBody.replace(OLD, NEW);

fs.writeFileSync(SRC, JSON.stringify(j, null, 2));

console.log('OK. JSON file synced with n8n prompt change.');
console.log('  Has "Six sentences written":', node.parameters.jsonBody.includes('Six sentences written'));
console.log('  Has STYLE RULES:', node.parameters.jsonBody.includes('STYLE RULES'));
console.log('  Has "under 150 words":', node.parameters.jsonBody.includes('under 150 words'));
console.log('  Old "SIX sentences" gone:', !node.parameters.jsonBody.includes('SIX sentences'));
console.log('  DO NOT mention cover letter preserved:', node.parameters.jsonBody.includes('DO NOT mention the cover letter'));
