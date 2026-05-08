# Resume Fit Analyzer

Internal tool for 5C Network recruiting. Automatically scores and ranks candidate resumes against the job descriptions of the role they applied for.

## How it works

1. Candidates apply via 5C's job application form (uploads resume to Google Drive / Vercel Blob)
2. Application data lands in **NocoDB** (candidates table)
3. **n8n workflow** runs every 6 hours: pulls unscored rows, downloads each resume PDF, asks GPT-4.1-mini to extract structured fields and score the candidate against the matching JD (Skills 40% / Experience 30% / Previous-role 20% / Education 10%)
4. Scores + extracted resume JSON are written back to NocoDB
5. **Next.js dashboard** reads scored candidates from NocoDB and lets recruiters filter, rank, and review

## Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS, deployed on Vercel
- **Auth:** Firebase Email/Password (accounts created manually by admin)
- **Database:** NocoDB (self-hosted at `answermagic.5cn.co.in`)
- **Workflow:** n8n (self-hosted at `groot.5cn.co.in`)
- **LLM:** OpenAI GPT-4.1-mini (resume extraction + scoring)

## Repo structure

```
.
├── frontend/                 Next.js app (the dashboard)
│   ├── app/                  Pages & API routes
│   ├── components/           UI components
│   ├── lib/                  NocoDB client, ranking logic, types
│   └── .env.local.example    Template — copy to .env.local and fill in
└── n8n-workflows/
    └── resume-screening-full-pipeline.json   Import this into n8n
```

## Local setup

### 1. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local — fill in NOCODB_TOKEN and Firebase keys
npm run dev
```

Open http://localhost:3000 — sign in with a Firebase user account (created in Firebase Console).

### 2. n8n workflow

1. Open n8n UI
2. Import `n8n-workflows/resume-screening-full-pipeline.json`
3. Set environment variables on the n8n server: `NOCODB_TOKEN`, `OPENAI_API_KEY`
4. Activate the workflow

## Environment variables

See [`frontend/.env.local.example`](frontend/.env.local.example) for the full list. Never commit real values — they go in `.env.local` (gitignored) or as Vercel project env vars in production.

## Deployment

- Frontend → Vercel (set env vars in Vercel project settings)
- n8n → already deployed at `groot.5cn.co.in`

---

Maintained by 5C Engineering.
