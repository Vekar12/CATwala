# CATWala — India's Most Realistic CAT Mock Test Platform

## What is CATWala?
CATWala is a free CAT MBA entrance exam mock test platform that replicates
the exact official CAT exam experience — same UI, same rules, same scoring.

## Features
- 12 full-length mock tests (68 questions, 120 minutes each)
- Exact CAT exam interface — 3-panel layout, question palette, section timers
- MCQ and TITA question types
- +3 / -1 / 0 scoring with estimated percentile
- Full answer review with solutions and concept tags
- Sequential unlock — complete Test 1 to unlock Test 2, and so on
- Works entirely in the browser — no login required

## Tech Stack
- React 18 + Vite
- React Router v6
- localStorage for state persistence
- Hosted on GitHub Pages

## Running Locally
npm install
npm run dev
Open http://localhost:5173/catwala/

## Deploying to GitHub Pages
Step 1: Create a GitHub repo named exactly: catwala
Step 2: Initialize git in the project folder:
  git init
  git remote add origin https://github.com/YOUR_USERNAME/catwala.git
Step 3: Push your code:
  git add .
  git commit -m "Initial commit"
  git push -u origin main
Step 4: Deploy:
  npm run deploy
Step 5: Go to GitHub repo → Settings → Pages →
  Source: Deploy from branch → Branch: gh-pages → Save
Step 6: Your app will be live at:
  https://YOUR_USERNAME.github.io/catwala/

## Adding More Tests
Drop new test JSON files into src/data/ following the naming convention:
  test1.json, test2.json, ... test12.json
The app automatically detects and loads them.

## Future Upgrades (Backend)
When ready to add user accounts and a real database:
1. Set up a Supabase project
2. Run the schema SQL from /docs/schema.sql
3. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env
4. Replace localStorage calls in src/utils/storage.js with Supabase calls

## Question Bank Structure
Each test JSON file in src/data/ follows this structure:
{
  "testId": 1,
  "title": "CATWala Mock Test 1",
  "sections": {
    "VARC": { "questions": [...], "duration_minutes": 40 },
    "DILR": { "questions": [...], "duration_minutes": 40 },
    "QA":   { "questions": [...], "duration_minutes": 40 }
  }
}
