import { useState, useRef, useEffect, useCallback } from "react";

const theme = {
  bg: "#0A0F1E", surface: "#0F1729", card: "#131D35", border: "#1E2D50",
  accent: "#2563EB", accentLight: "#60A5FA", gold: "#F59E0B",
  text: "#E2E8F0", textMuted: "#64748B", textSoft: "#94A3B8",
  success: "#10B981", danger: "#EF4444",
};

// ============================================================
// ✅ PASTE YOUR OPENROUTER API KEY BELOW (between the quotes)
// Get it free from: https://openrouter.ai
// ============================================================
const OPENROUTER_API_KEY = "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";
const MODEL = "meta-llama/llama-3-8b-instruct";

const SYSTEM_PROMPT = `You are MortgageAI, a highly specialized AI mortgage payment planning assistant. Your ONLY domain is mortgage-related finance. You help users understand:
1. Mortgage calculations (EMI, amortization, total interest)
2. Mortgage types (fixed-rate, adjustable-rate, FHA, VA, jumbo)
3. Down payment strategies and impact
4. Mortgage refinancing analysis
5. Prepayment strategies to reduce interest
6. Debt-to-income ratio guidance
7. Mortgage insurance (PMI) and when it can be removed
8. Budgeting for mortgage payments
9. Comparing mortgage offers from lenders
10. Tax implications of mortgage interest

STRICT DOMAIN RULE: If asked anything outside mortgage finance, politely decline and redirect. Say: "I'm specialized exclusively in mortgage planning. I can't help with [topic], but I can help you with [mortgage topic]."

Be professional, precise, show calculations clearly, use dollar amounts and percentages concretely.`;

function calcMortgage({ principal, annualRate, termYears, downPct }) {
  const p = principal * (1 - downPct / 100);
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return { emi: p / n, totalPayment: p, totalInterest: 0, loanAmt: p };
  const emi = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPayment = emi * n;
  return { emi, totalPayment, totalInterest: totalPayment - p, loanAmt: p };
}

function buildAmortization({ principal, annualRate, termYears, downPct }) {
  const p = principal * (1 - downPct / 100);
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  const emi = r === 0 ? p / n : (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  let balance = p;
  const schedule = [];
  for (let i = 1; i <= n; i++) {
    const interest = balance * r;
    const pp = emi - interest;
    balance -= pp;
    schedule.push({ month: i, year: Math.ceil(i / 12), principal: pp, interest, balance: Math.max(0, balance) });
  }
  return schedule;
}

const fmt = n => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtD = n => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

function DonutChart({ principal, interest }) {
  const total = principal + interest;
  const pPct = (principal / total) * 100;
  const iPct = (interest / total) * 100;
  const r = 70, cx = 90, cy = 90, stroke = 22;
  const circ = 2 * Math.PI * r;
  const pDash = (pPct / 100) * circ;
  const iDash = (iPct / 100) * circ;
  return (
    <svg width="180" height="180" viewBox="0 0 180 180">
      <defs>
        <linearGradient id="gP" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#2563EB" /><stop offset="100%" stopColor="#7C3AED" /></linearGradient>
        <linearGradient id="gI" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#EF4444" /></linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1E2D50" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#gP)" strokeWidth={stroke} strokeDasharray={`${pDash} ${circ - pDash}`} strokeDashoffset={circ / 4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#gI)" strokeWidth={stroke} strokeDasharray={`${iDash} ${circ - iDash}`} strokeDashoffset={circ / 4 - pDash} strokeLinecap="round" />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#E2E8F0" fontSize="11" fontFamily="monospace">SPLIT</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#60A5FA" fontSize="13" fontFamily="monospace" fontWeight="bold">{pPct.toFixed(0)}%</text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill="#94A3B8" fontSize="9" fontFamily="monospace">principal</text>
    </svg>
  );
}

function AmortizationChart({ schedule }) {
  const yearly = {};
  schedule.forEach(({ year, principal, interest }) => {
    if (!yearly[year]) yearly[year] = { principal: 0, interest: 0 };
    yearly[year].principal += principal;
    yearly[year].interest += interest;
  });
  const years = Object.entries(yearly).map(([y, v]) => ({ year: +y, ...v }));
  const maxVal = Math.max(...years.map(y => y.principal + y.interest));
  const barW = Math.max(6, Math.floor(420 / years.length) - 2);
  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <svg width={Math.max(420, years.length * (barW + 2) + 40)} height="160" style={{ display: "block" }}>
        {years.map((y, i) => {
          const pH = (y.principal / maxVal) * 120;
          const iH = (y.interest / maxVal) * 120;
          const x = 20 + i * (barW + 2);
          return (
            <g key={y.year}>
              <rect x={x} y={140 - pH - iH} width={barW} height={iH} fill="#F59E0B" opacity="0.85" rx="2" />
              <rect x={x} y={140 - pH} width={barW} height={pH} fill="#2563EB" opacity="0.9" rx="2" />
              {years.length <= 20 && <text x={x + barW / 2} y="155" textAnchor="middle" fill="#64748B" fontSize="8" fontFamily="monospace">{y.year}</text>}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: theme.textMuted }}><span style={{ width: 10, height: 10, background: "#2563EB", borderRadius: 2, display: "inline-block" }} /> Principal</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: theme.textMuted }}><span style={{ width: 10, height: 10, background: "#F59E0B", borderRadius: 2, display: "inline-block" }} /> Interest</span>
      </div>
    </div>
  );
}

function SliderInput({ label, value, onChange, min, max, step, format, icon }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ color: theme.textSoft, fontSize: 12, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>{icon} {label}</span>
        <span style={{ color: theme.accentLight, fontSize: 14, fontWeight: 700, fontFamily: "monospace", background: "#0A1628", padding: "2px 10px", borderRadius: 6, border: `1px solid ${theme.border}` }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: theme.accent, cursor: "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ color: theme.textMuted, fontSize: 9 }}>{format(min)}</span>
        <span style={{ color: theme.textMuted, fontSize: 9 }}>{format(max)}</span>
      </div>
    </div>
  );
}

function ChatBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 16 }}>
      {!isUser && <div style={{ width: 32, height: 32, borderRadius: "50%", marginRight: 10, flexShrink: 0, background: "linear-gradient(135deg, #2563EB, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontWeight: 700 }}>M</div>}
      <div style={{ maxWidth: "80%", padding: "12px 16px", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isUser ? "linear-gradient(135deg, #2563EB, #7C3AED)" : theme.card, border: isUser ? "none" : `1px solid ${theme.border}`, color: theme.text, fontSize: 13, lineHeight: 1.6, fontFamily: "Georgia, serif", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {msg.content}
      </div>
      {isUser && <div style={{ width: 32, height: 32, borderRadius: "50%", marginLeft: 10, flexShrink: 0, background: theme.border, display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("calculator");
  const [homePrice, setHomePrice] = useState(450000);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(6.8);
  const [term, setTerm] = useState(30);
  const [showAmort, setShowAmort] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hello! I'm MortgageAI 🏠 — your dedicated mortgage planning assistant.\n\nI can help you understand EMI calculations, compare loan options, analyze prepayment strategies, and plan your mortgage budget.\n\nNote: I'm exclusively specialized in mortgage finance. Ask me anything about your home loan!" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const mortgage = calcMortgage({ principal: homePrice, annualRate: rate, termYears: term, downPct });
  const schedule = buildAmortization({ principal: homePrice, annualRate: rate, termYears: term, downPct });

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    const calcContext = `[MORTGAGE PARAMETERS: Home Price: ${fmt(homePrice)}, Down Payment: ${downPct}% (${fmt(homePrice * downPct / 100)}), Loan: ${fmt(mortgage.loanAmt)}, Rate: ${rate}%, Term: ${term}yrs, EMI: ${fmtD(mortgage.emi)}, Total Interest: ${fmt(mortgage.totalInterest)}, Total Cost: ${fmt(mortgage.totalPayment)}]\n\n`;

    const chatHistory = newMessages.map((m, idx) => ({
      role: m.role,
      content: idx === 0 && m.role === "user" ? calcContext + m.content : m.content,
    }));

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "MortgageAI Planner",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...chatHistory],
          temperature: 0.3,
          max_tokens: 1000,
          top_p: 0.9,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages([...newMessages, { role: "assistant", content: `API Error: ${data.error.message}\n\nPlease check your OpenRouter API key on line 11 of App.jsx` }]);
        return;
      }
      const reply = data.choices?.[0]?.message?.content || "Sorry, could not process that. Please try again.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Connection error. Please check your internet and API key." }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, homePrice, downPct, rate, term, mortgage]);

  const handleKeyDown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const quickPrompts = ["Should I put 20% down or less?", "How much interest will I save with prepayments?", "What's a good debt-to-income ratio?", "When can I remove PMI?"];

  const btnStyle = active => ({ padding: "6px 18px", borderRadius: 7, border: "none", cursor: "pointer", background: active ? "linear-gradient(135deg, #2563EB, #7C3AED)" : "transparent", color: active ? "#fff" : theme.textMuted, fontSize: 11, fontFamily: "monospace", transition: "all 0.2s" });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0F1E; }
        input[type=range] { -webkit-appearance: none; background: transparent; width: 100%; }
        input[type=range]::-webkit-slider-runnable-track { height: 4px; background: #1E2D50; border-radius: 2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; background: linear-gradient(135deg, #2563EB, #7C3AED); border-radius: 50%; margin-top: -6px; cursor: pointer; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#1E2D50;border-radius:2px}
        textarea:focus,input:focus{outline:none}
      `}</style>

      <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: "monospace", color: theme.text }}>

        {/* HEADER */}
        <div style={{ background: theme.surface, borderBottom: `1px solid ${theme.border}`, padding: "0 24px", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #2563EB, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏠</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>MortgageAI</div>
                <div style={{ fontSize: 9, color: theme.textMuted, letterSpacing: "0.1em" }}>SMART MORTGAGE PLANNER · INT428</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, background: theme.card, padding: 4, borderRadius: 10, border: `1px solid ${theme.border}` }}>
              <button style={btnStyle(tab === "calculator")} onClick={() => setTab("calculator")}>📊 Calculator</button>
              <button style={btnStyle(tab === "chat")} onClick={() => setTab("chat")}>💬 AI Advisor</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: theme.success, boxShadow: `0 0 8px ${theme.success}` }} />
              <span style={{ fontSize: 10, color: theme.textMuted }}>OpenRouter · Free</span>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>

          {/* CALCULATOR TAB */}
          {tab === "calculator" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 20, color: theme.accentLight, letterSpacing: "0.1em" }}>LOAN PARAMETERS</div>
                  <SliderInput label="Home Price" value={homePrice} onChange={setHomePrice} min={100000} max={2000000} step={5000} format={fmt} icon="🏡" />
                  <SliderInput label="Down Payment" value={downPct} onChange={setDownPct} min={3} max={50} step={1} format={v => `${v}%`} icon="💰" />
                  <SliderInput label="Interest Rate (APR)" value={rate} onChange={setRate} min={2} max={12} step={0.05} format={v => `${v.toFixed(2)}%`} icon="📈" />
                  <SliderInput label="Loan Term" value={term} onChange={setTerm} min={5} max={30} step={5} format={v => `${v} yrs`} icon="🗓" />
                </div>
                <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showAmort ? 16 : 0 }}>
                    <span style={{ fontSize: 12, color: theme.textSoft }}>📉 Amortization Schedule</span>
                    <button onClick={() => setShowAmort(s => !s)} style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.textSoft, fontSize: 11, padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "monospace" }}>{showAmort ? "Hide ▲" : "Show ▼"}</button>
                  </div>
                  {showAmort && <AmortizationChart schedule={schedule} />}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "linear-gradient(135deg, #0F1B3D, #1A1040)", border: `1px solid #2563EB44`, borderRadius: 16, padding: 28, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: theme.textMuted, letterSpacing: "0.15em", marginBottom: 8 }}>MONTHLY PAYMENT (EMI)</div>
                  <div style={{ fontSize: 44, fontWeight: 800, background: "linear-gradient(135deg, #60A5FA, #A78BFA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-2px" }}>{fmtD(mortgage.emi)}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>per month for {term} years</div>
                  <div style={{ display: "flex", gap: 16, marginTop: 20, justifyContent: "center" }}>
                    {[{ label: "Loan Amount", val: fmt(mortgage.loanAmt), color: "#60A5FA" }, { label: "Down Payment", val: fmt(homePrice * downPct / 100), color: "#A78BFA" }].map(({ label, val, color }) => (
                      <div key={label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color }}>{val}</div>
                        <div style={{ fontSize: 9, color: theme.textMuted, marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Total Payment", val: fmt(mortgage.totalPayment), icon: "💳", color: theme.accentLight },
                    { label: "Total Interest", val: fmt(mortgage.totalInterest), icon: "📊", color: theme.gold },
                    { label: "Interest %", val: `${((mortgage.totalInterest / mortgage.totalPayment) * 100).toFixed(1)}%`, icon: "🔢", color: "#EF4444" },
                    { label: "Effective Rate", val: `${((mortgage.totalInterest / mortgage.loanAmt) * 100).toFixed(1)}%`, icon: "📐", color: theme.success },
                  ].map(({ label, val, icon, color }) => (
                    <div key={label} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color }}>{val}</div>
                      <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20, display: "flex", alignItems: "center", gap: 20 }}>
                  <DonutChart principal={mortgage.loanAmt} interest={mortgage.totalInterest} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: theme.textSoft, marginBottom: 12 }}>Payment Breakdown</div>
                    {[
                      { label: "Principal", val: fmt(mortgage.loanAmt), color: "#2563EB", pct: ((mortgage.loanAmt / mortgage.totalPayment) * 100).toFixed(1) },
                      { label: "Total Interest", val: fmt(mortgage.totalInterest), color: "#F59E0B", pct: ((mortgage.totalInterest / mortgage.totalPayment) * 100).toFixed(1) },
                    ].map(({ label, val, color, pct }) => (
                      <div key={label} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: theme.textSoft }}>{label}</span>
                          <span style={{ fontSize: 11, color, fontWeight: 700 }}>{pct}%</span>
                        </div>
                        <div style={{ height: 4, background: theme.border, borderRadius: 2 }}>
                          <div style={{ height: 4, width: `${pct}%`, background: color, borderRadius: 2 }} />
                        </div>
                        <div style={{ fontSize: 11, color, marginTop: 3, fontWeight: 600 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={() => setTab("chat")} style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)", border: "none", borderRadius: 12, padding: "14px 20px", color: "#fff", fontSize: 13, fontFamily: "monospace", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 600 }}>
                  💬 Ask MortgageAI About These Numbers →
                </button>
              </div>
            </div>
          )}

          {/* CHAT TAB */}
          {tab === "chat" && (
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, height: "calc(100vh - 130px)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 10, color: theme.textMuted, letterSpacing: "0.1em", marginBottom: 12 }}>YOUR MORTGAGE SNAPSHOT</div>
                  {[
                    { label: "Home Price", val: fmt(homePrice) },
                    { label: "Down", val: `${downPct}% · ${fmt(homePrice * downPct / 100)}` },
                    { label: "Rate", val: `${rate}% APR` },
                    { label: "Term", val: `${term} years` },
                    { label: "Monthly EMI", val: fmtD(mortgage.emi), highlight: true },
                    { label: "Total Interest", val: fmt(mortgage.totalInterest) },
                  ].map(({ label, val, highlight }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${theme.border}` }}>
                      <span style={{ fontSize: 10, color: theme.textMuted }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: highlight ? 700 : 500, color: highlight ? theme.accentLight : theme.textSoft }}>{val}</span>
                    </div>
                  ))}
                  <button onClick={() => setTab("calculator")} style={{ marginTop: 12, width: "100%", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "7px 0", color: theme.textSoft, fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>← Edit Parameters</button>
                </div>

                <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 10, color: theme.textMuted, letterSpacing: "0.1em", marginBottom: 10 }}>QUICK QUESTIONS</div>
                  {quickPrompts.map(q => (
                    <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }} style={{ display: "block", width: "100%", textAlign: "left", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "8px 10px", color: theme.textSoft, fontSize: 10, cursor: "pointer", marginBottom: 6, fontFamily: "Georgia, serif", lineHeight: 1.4 }}>{q}</button>
                  ))}
                </div>

                <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 10, color: theme.textMuted, marginBottom: 8, letterSpacing: "0.1em" }}>MODEL CONFIG</div>
                  {[["Model", "Llama 4 Scout"], ["Provider", "OpenRouter"], ["Temperature", "0.3"], ["Domain", "Mortgage Only"], ["Top-p", "0.9"], ["Cost", "Free ✅"]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 9, padding: "4px 0", borderBottom: `1px solid ${theme.border}` }}>
                      <span style={{ color: theme.textMuted }}>{k}</span>
                      <span style={{ color: k === "Cost" ? theme.success : theme.textSoft }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(90deg, #0F1B3D, transparent)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #2563EB, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏠</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>MortgageAI Advisor</div>
                    <div style={{ fontSize: 10, color: theme.success, display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.success, display: "inline-block" }} />
                      Online · OpenRouter Free · Mortgage Domain Only
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                  {messages.map((m, i) => <ChatBubble key={i} msg={m} />)}
                  {loading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #2563EB, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>M</div>
                      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 18, padding: "12px 16px", display: "flex", gap: 6 }}>
                        {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: theme.accent, animationName: "pulse", animationDuration: "1.2s", animationIterationCount: "infinite", animationDelay: `${i * 0.2}s` }} />)}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div style={{ padding: 16, borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ display: "flex", gap: 10, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "4px 4px 4px 16px" }}>
                    <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask anything about mortgages, EMI, refinancing..." rows={1} style={{ flex: 1, background: "transparent", border: "none", resize: "none", color: theme.text, fontSize: 13, fontFamily: "Georgia, serif", paddingTop: 8, lineHeight: 1.5, maxHeight: 100, overflowY: "auto" }} />
                    <button onClick={sendMessage} disabled={!input.trim() || loading} style={{ background: input.trim() && !loading ? "linear-gradient(135deg, #2563EB, #7C3AED)" : theme.border, border: "none", borderRadius: 10, padding: "8px 16px", color: "#fff", fontSize: 16, cursor: input.trim() && !loading ? "pointer" : "not-allowed", alignSelf: "flex-end", marginBottom: 4 }}>
                      {loading ? "⏳" : "➤"}
                    </button>
                  </div>
                  <div style={{ fontSize: 9, color: theme.textMuted, marginTop: 6, textAlign: "center" }}>⚠️ MortgageAI responds only to mortgage-related questions · Press Enter to send</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
