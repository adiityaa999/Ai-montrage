# 🏠 MortgageAI - Smart Mortgage Planner
### INT428 Project | AI Mortgage Payment Planner

---

## ✅ HOW TO RUN THIS PROJECT

### Step 1 — Add Your API Key
Open `src/App.jsx` and find line 11:
```
const OPENROUTER_API_KEY = "PASTE_YOUR_OPENROUTER_KEY_HERE";
```
Replace with your free key from https://openrouter.ai

### Step 2 — Install & Run
Open terminal in this folder and run:
```
npm install
npm run dev
```

### Step 3 — Open Browser
Go to: http://localhost:5173

---

## 🎯 FEATURES
- Live mortgage EMI calculator with sliders
- Donut chart showing principal vs interest split
- Yearly amortization bar chart
- AI chat advisor (domain-locked to mortgage only)
- Powered by Llama 4 via OpenRouter (FREE)

## 🛠 TECH STACK
- Frontend: React + Vite
- AI API: OpenRouter (Llama 4 Scout - Free)
- No backend, no database needed

## 📋 PROJECT INFO
- Course: INT428
- Topic: AI Mortgage Payment Planner
- Model: meta-llama/llama-4-scout:free
- Temperature: 0.3 | Top-p: 0.9
