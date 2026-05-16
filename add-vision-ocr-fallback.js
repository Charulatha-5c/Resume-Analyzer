// Adds OCR fallback (OpenAI Vision via Files API) to resume-extraction-only.json.
// For Canva/scanned PDFs where pdf-parse returns empty text, upload PDF to OpenAI
// and use GPT-4.1-mini Vision to extract text.
//
// New flow on the PDF branch:
//   Fetch PDF Binary → Extract Text From PDF → IF Text Empty?
//                                                 ├─ FALSE → Prepare Resume Text (existing)
//                                                 └─ TRUE  → Upload PDF to OpenAI → GPT Vision Extract → Parse Vision Response → Prepare Resume Text
//
// Adds 4 new nodes:
//   - IF Text Empty?
//   - Upload PDF to OpenAI
//   - GPT Vision Extract
//   - Parse Vision Response

const fs = require('fs');
const SRC = 'c:/Users/charulatha.k/Documents/my_app/n8n-workflows/resume-extraction-only.json';
const j = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// 1. IF Text Empty? — checks if pdf-parse output is too short to be a real resume
const ifTextEmpty = {
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      conditions: [
        {
          id: 'text-empty',
          leftValue: "={{ ($json.text || '').toString().trim().length < 100 }}",
          rightValue: true,
          operator: { type: 'boolean', operation: 'true', singleValue: true }
        }
      ],
      combinator: 'and'
    },
    options: {}
  },
  id: 'f1000000-0000-0000-0000-000000000070',
  name: 'IF Text Empty?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2,
  position: [3000, 100]
};

// 2. Upload PDF to OpenAI Files (multipart POST)
const uploadPDF = {
  parameters: {
    method: 'POST',
    url: 'https://api.openai.com/v1/files',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'Authorization', value: '=Bearer {{ $env.OPENAI_API_KEY }}' }
      ]
    },
    sendBody: true,
    contentType: 'multipart-form-data',
    bodyParameters: {
      parameters: [
        { name: 'purpose', value: 'user_data' },
        { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }
      ]
    },
    options: {}
  },
  id: 'f1000000-0000-0000-0000-000000000071',
  name: 'Upload PDF to OpenAI',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [3220, 50],
  retryOnFail: true,
  maxTries: 2,
  waitBetweenTries: 2000,
  continueOnFail: true
};

// 3. GPT Vision Extract — chat completions with file_id reference
const visionExtract = {
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
    jsonBody: `={\n  "model": "gpt-4.1-mini",\n  "max_tokens": 3000,\n  "messages": [\n    {\n      "role": "user",\n      "content": [\n        { "type": "text", "text": "Extract ALL text content from this resume PDF. Output plain text only, preserving structure (name, contact info, education, experience, skills, certifications, projects, summary, etc). Do NOT summarize or restructure — output the raw resume text as accurately as possible. If the document is not a resume or is unreadable, output: [UNREADABLE]." },\n        { "type": "file", "file": { "file_id": "{{ $json.id }}" } }\n      ]\n    }\n  ]\n}`,
    options: {}
  },
  id: 'f1000000-0000-0000-0000-000000000072',
  name: 'GPT Vision Extract',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [3440, 50],
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 2000,
  continueOnFail: true
};

// 4. Parse Vision Response — extract text and conform to Prepare Resume Text's expected shape
const parseVision = {
  parameters: {
    mode: 'runOnceForEachItem',
    jsCode: `const resp = $json;
const raw = resp && resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content;
const text = String(raw || '').trim();
if (!text || text === '[UNREADABLE]') {
  return { json: { text: '[NO RESUME TEXT — Vision OCR could not read the PDF (likely highly stylized or corrupt). Source: image-based PDF.]' } };
}
return { json: { text } };`
  },
  id: 'f1000000-0000-0000-0000-000000000073',
  name: 'Parse Vision Response',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [3660, 50]
};

j.nodes.push(ifTextEmpty, uploadPDF, visionExtract, parseVision);

// 5. REWIRE
// Currently: Extract Text From PDF → Prepare Resume Text
// New:       Extract Text From PDF → IF Text Empty?
//                                       ├─ FALSE → Prepare Resume Text
//                                       └─ TRUE  → Upload PDF → Vision → Parse Vision → Prepare Resume Text

j.connections['Extract Text From PDF'] = {
  main: [[{ node: 'IF Text Empty?', type: 'main', index: 0 }]]
};
j.connections['IF Text Empty?'] = {
  main: [
    [{ node: 'Upload PDF to OpenAI', type: 'main', index: 0 }],   // TRUE
    [{ node: 'Prepare Resume Text', type: 'main', index: 0 }]      // FALSE
  ]
};
j.connections['Upload PDF to OpenAI'] = { main: [[{ node: 'GPT Vision Extract', type: 'main', index: 0 }]] };
j.connections['GPT Vision Extract'] = { main: [[{ node: 'Parse Vision Response', type: 'main', index: 0 }]] };
j.connections['Parse Vision Response'] = { main: [[{ node: 'Prepare Resume Text', type: 'main', index: 0 }]] };

fs.writeFileSync(SRC, JSON.stringify(j, null, 2));

console.log('Total nodes now:', j.nodes.length);
console.log();
console.log('New OCR nodes added:');
['IF Text Empty?','Upload PDF to OpenAI','GPT Vision Extract','Parse Vision Response'].forEach(n => {
  console.log('  ' + (j.nodes.find(x => x.name === n) ? '✓' : '✗') + ' ' + n);
});
console.log();
console.log('Wiring verification:');
console.log('  Extract Text From PDF →', JSON.stringify(j.connections['Extract Text From PDF']));
console.log('  IF Text Empty? TRUE  →', JSON.stringify(j.connections['IF Text Empty?'].main[0]));
console.log('  IF Text Empty? FALSE →', JSON.stringify(j.connections['IF Text Empty?'].main[1]));
