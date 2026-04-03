# Call QA Scorer

AI-powered call transcript quality analysis utility. Upload call transcripts, evaluate them against customizable QA scorecards, and get detailed compliance reports with per-item scoring, critical fail detection, and actionable feedback.

## Features

- **AI-Powered Scoring** — Uses Claude to analyze transcripts against scorecard criteria
- **Customizable Scorecards** — Upload your own scorecard via CSV/TXT or use the built-in SkyBridge default
- **Drag & Drop** — Drag transcript or scorecard files directly onto the interface
- **Detailed Reports** — Per-item scoring with reasoning, critical fail detection, strengths, and opportunities
- **Sample Transcripts** — Built-in compliant and non-compliant call examples for testing

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/call-qa-scorer.git
cd call-qa-scorer
npm install
```

### 2. Set your API key

Create a `.env.local` file:

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

### Option A: One-Click (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repo
4. Add environment variable: `ANTHROPIC_API_KEY` = your key
5. Deploy

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel --prod
# When prompted, add ANTHROPIC_API_KEY as an environment variable
```

## Custom Scorecard Format

Upload a `.csv` or `.txt` file in the Settings tab.

### CSV format

```
Section,Item,Criteria,Points
Compliance,Identification,Agent states their name and company,5
Compliance,Recording disclosure,States call is recorded before PII,5
Introduction,Benefits explained,Explains program benefits,10
```

### Text format

```
Compliance:
- Identification - Agent states name and company - 5 pts
- Recording disclosure - States call is recorded - 5 pts

Introduction:
- Benefits explained - Explains program benefits - 10 pts

Critical Fail Conditions:
- Failure to verify identity before sharing account details
- Misrepresenting the product
```

## Project Structure

```
call-qa-scorer/
├── src/
│   ├── app/
│   │   ├── api/score/route.ts   # Server-side Anthropic API proxy
│   │   ├── globals.css           # Global styles
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Main app (client component)
│   └── lib/
│       └── scorecard.ts          # Types, default scorecard, parser
├── .env.example
├── next.config.js
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Next.js 14** (App Router)
- **React 18**
- **Anthropic Claude API** (via `@anthropic-ai/sdk`)
- **TypeScript**

## Security

The Anthropic API key stays server-side in the Next.js API route (`/api/score`). It is never exposed to the browser. Make sure to add it only as an environment variable (not committed to git).
