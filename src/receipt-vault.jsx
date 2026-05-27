import { useState, useRef, useEffect } from "react";

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const CATEGORIES = {
  business: ["Meals & Entertainment","Travel","Supplies","Software","Marketing","Equipment","Utilities","Professional Services","Vehicle","Other Business"],
  personal: ["Groceries","Dining Out","Gas","Healthcare","Shopping","Entertainment","Utilities","Home","Clothing","Other Personal"]
};

const PAYMENT_METHODS = ["Credit Card","Debit Card","Cash","Check","Zelle","Venmo","PayPal","Other"];

function StatCard({ label, value, accent }) {
  return (
    <div style={{ background: "#181614", borderRadius: "16px", padding: "16px 18px", flex: 1 }}>
      <div style={{ fontSize: "10px", color: "#5c5650", textTransform: "uppercase", letterSpacing: "2.5px", marginBottom: "6px", fontWeight: "600" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: "700", fontFamily: "'JetBrains Mono',monospace", color: accent || "#c9a84c" }}>{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", prefix, placeholder }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #232120" }}>
      <div style={{ fontSize: "11px", color: "#5c5650", width: "88px", flexShrink: 0, textTransform: "uppercase", letterSpacing: "1px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
        {prefix && <span style={{ color: "#5c5650", marginRight: "4px", fontFamily: "'JetBrains Mono',monospace" }}>{prefix}</span>}
        <input
          type={type}
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ""}
          style={{ background: "none", border: "none", color: "#f0ebe2", fontSize: "14px", flex: 1, fontFamily: type === "number" ? "'JetBrains Mono',monospace" : "'Syne',sans-serif", outline: "none", padding: 0 }}
        />
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #232120" }}>
      <div style={{ fontSize: "11px", color: "#5c5650", width: "88px", flexShrink: 0, textTransform: "uppercase", letterSpacing: "1px" }}>{label}</div>
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        style={{ background: "#181614", border: "none", color: "#f0ebe2", fontSize: "14px", flex: 1, fontFamily: "'Syne',sans-serif", outline: "none", padding: "2px 0" }}
      >
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ReceiptCard({ receipt, onClick }) {
  const catColor = receipt.category === "business" ? "#6fa8dc" : receipt.category === "personal" ? "#e06c94" : "#5c5650";
  return (
    <div onClick={onClick} style={{ background: "#181614", borderRadius: "14px", padding: "14px 16px", marginBottom: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", transition: "background 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.background = "#1e1c1a"}
      onMouseLeave={e => e.currentTarget.style.background = "#181614"}>
      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: receipt.category === "business" ? "#6fa8dc22" : receipt.category === "personal" ? "#e06c9422" : "#2a2724", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
        {receipt.category === "business" ? "💼" : receipt.category === "personal" ? "🏠" : "🧾"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: "600", fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{receipt.merchant || "Unknown Merchant"}</div>
        <div style={{ fontSize: "12px", color: "#5c5650", marginTop: "2px" }}>
          {receipt.date}
          {receipt.subcategory && <span style={{ color: catColor }}> · {receipt.subcategory}</span>}
        </div>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: "600", color: "#c9a84c", fontSize: "15px", flexShrink: 0 }}>
        ${parseFloat(receipt.total || 0).toFixed(2)}
      </div>
    </div>
  );
}

export default function ReceiptVault() {
  const [view, setView] = useState("home");
  const [receipts, setReceipts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("receipt-vault-data") || "[]"); } catch { return []; }
  });
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [current, setCurrent] = useState(null);
  const [listening, setListening] = useState(false);
  const [filter, setFilter] = useState("all");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("receipt-vault-key") || "");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const fileRef = useRef();
  const recogRef = useRef();

  useEffect(() => {
    localStorage.setItem("receipt-vault-data", JSON.stringify(receipts));
  }, [receipts]);

  const saveKey = (k) => {
    setApiKey(k);
    localStorage.setItem("receipt-vault-key", k);
    setShowKeyInput(false);
  };

  const handleCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileRef.current.value = "";

    if (!apiKey) { setShowKeyInput(true); return; }

    setScanning(true);
    setScanStatus("Reading your receipt...");
    setView("scan");

    // Get location
    let location = null;
    try {
      setScanStatus("Getting location...");
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 }));
      location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${location.lat}&lon=${location.lng}&format=json`);
        const gd = await geo.json();
        location.address = gd.display_name;
        location.city = gd.address?.city || gd.address?.town || gd.address?.village || "";
      } catch {}
    } catch {}

    // Convert image to base64
    const base64 = await new Promise(res => {
      const reader = new FileReader();
      reader.onload = ev => res(ev.target.result.split(",")[1]);
      reader.readAsDataURL(file);
    });

    setScanStatus("Extracting data with AI...");
    let extracted = {};
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } },
              { type: "text", text: `Extract all receipt data and return ONLY valid JSON, no markdown, no extra text:
{"merchant":"store name","date":"YYYY-MM-DD","total":0.00,"subtotal":0.00,"tax":0.00,"tip":0.00,"payment_method":"","items":[{"name":"","qty":1,"price":0.00}],"currency":"USD","address":"street address if visible","phone":""}` }
            ]
          }]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const raw = data.content?.[0]?.text || "{}";
      extracted = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (err) {
      console.error("Extraction error:", err);
      setScanStatus("Could not read receipt automatically. Enter details manually.");
    }

    setCurrent({
      id: Date.now(),
      merchant: extracted.merchant || "",
      date: extracted.date || new Date().toISOString().split("T")[0],
      total: extracted.total || 0,
      subtotal: extracted.subtotal || 0,
      tax: extracted.tax || 0,
      tip: extracted.tip || 0,
      payment_method: extracted.payment_method || "",
      items: extracted.items || [],
      currency: extracted.currency || "USD",
      merchant_address: extracted.address || "",
      category: null,
      subcategory: null,
      note: "",
      voiceNote: "",
      location,
      scannedAt: new Date().toISOString(),
    });

    setScanning(false);
    setView("review");
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input not supported in this browser. Try Chrome."); return; }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setCurrent(r => ({ ...r, voiceNote: r.voiceNote ? r.voiceNote + " " + transcript : transcript }));
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    recogRef.current = recognition;
    setListening(true);
  };

  const stopVoice = () => {
    recogRef.current?.stop();
    setListening(false);
  };

  const saveReceipt = () => {
    setReceipts(prev => [current, ...prev]);
    setCurrent(null);
    setView("home");
  };

  const deleteReceipt = (id) => {
    setReceipts(prev => prev.filter(r => r.id !== id));
    setView("home");
  };

  const exportCSV = () => {
    const headers = ["Date","Merchant","Total","Subtotal","Tax","Tip","Payment Method","Category","Subcategory","Note","Voice Note","City","Full Location","Scanned At"];
    const filtered = receipts.filter(r => filter === "all" || r.category === filter);
    const rows = filtered.map(r => [
      r.date, r.merchant, r.total, r.subtotal, r.tax, r.tip || 0, r.payment_method,
      r.category, r.subcategory, r.note, r.voiceNote,
      r.location?.city || "",
      r.location?.address || (r.location ? `${r.location.lat},${r.location.lng}` : ""),
      r.scannedAt
    ].map(v => `"${String(v || "").replace(/"/g, '""')}"`));
    const csv = [headers.map(h => `"${h}"`), ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipts_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const filtered = receipts.filter(r => filter === "all" || r.category === filter);
  const totalSpent = filtered.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
  const businessTotal = receipts.filter(r => r.category === "business").reduce((s, r) => s + (parseFloat(r.total) || 0), 0);

  const gold = "#c9a84c";
  const bg = "#111009";
  const surface = "#181614";
  const card = "#1e1c1a";
  const border = "#2a2724";
  const muted = "#5c5650";
  const text = "#f0ebe2";
  const blue = "#6fa8dc";
  const pink = "#e06c94";

  return (
    <div style={{ fontFamily: "'Syne',sans-serif", background: bg, minHeight: "100vh", color: text, maxWidth: "430px", margin: "0 auto", paddingBottom: "40px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.6); }
        ::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .fadeUp { animation: fadeUp 0.3s ease forwards; }
      `}</style>

      {/* API Key Modal */}
      {showKeyInput && (
        <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: surface, borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "360px" }}>
            <div style={{ fontWeight: "800", fontSize: "18px", marginBottom: "8px" }}>Anthropic API Key</div>
            <div style={{ fontSize: "13px", color: muted, marginBottom: "16px", lineHeight: "1.5" }}>
              Get your key at <span style={{ color: gold }}>console.anthropic.com</span>. It's stored locally on this device only.
            </div>
            <input
              autoFocus
              type="password"
              placeholder="sk-ant-..."
              defaultValue={apiKey}
              onKeyDown={e => e.key === "Enter" && saveKey(e.target.value)}
              id="keyInput"
              style={{ width: "100%", background: card, border: `1px solid ${border}`, borderRadius: "10px", padding: "12px", color: text, fontSize: "14px", fontFamily: "monospace", outline: "none", marginBottom: "12px" }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowKeyInput(false)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: `1px solid ${border}`, background: "none", color: muted, cursor: "pointer", fontFamily: "'Syne',sans-serif", fontSize: "14px" }}>Cancel</button>
              <button onClick={() => saveKey(document.getElementById("keyInput").value)} style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: gold, color: "#111009", cursor: "pointer", fontFamily: "'Syne',sans-serif", fontSize: "14px", fontWeight: "700" }}>Save & Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* ── HOME ── */}
      {view === "home" && (
        <div className="fadeUp">
          <div style={{ padding: "24px 20px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
              <div>
                <div style={{ fontSize: "10px", color: muted, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "2px" }}>Receipt Vault</div>
                <div style={{ fontSize: "26px", fontWeight: "800", lineHeight: "1" }}>Your Records</div>
              </div>
              <button onClick={() => setShowKeyInput(true)} title="API Key" style={{ background: "none", border: `1px solid ${border}`, borderRadius: "8px", padding: "6px 10px", color: muted, cursor: "pointer", fontSize: "18px" }}>⚙️</button>
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <StatCard label="Receipts" value={receipts.length} />
              <StatCard label="Business" value={`$${businessTotal.toFixed(2)}`} accent={blue} />
            </div>

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              {[["all","All"],["business","💼 Biz"],["personal","🏠 Personal"]].map(([val, label]) => (
                <button key={val} onClick={() => setFilter(val)} style={{
                  padding: "7px 14px", borderRadius: "20px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600", fontFamily: "'Syne',sans-serif",
                  background: filter === val ? (val === "business" ? blue : val === "personal" ? pink : gold) : card,
                  color: filter === val ? "#111009" : muted
                }}>{label}</button>
              ))}
              <button onClick={exportCSV} style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: "20px", border: `1px solid ${border}`, background: "none", color: muted, cursor: "pointer", fontSize: "13px", fontFamily: "'Syne',sans-serif" }}>↓ CSV</button>
            </div>
          </div>

          {/* Scan FAB */}
          <div style={{ padding: "0 20px 20px" }}>
            <button onClick={() => { if (!apiKey) { setShowKeyInput(true); } else { fileRef.current.click(); } }} style={{
              width: "100%", background: gold, color: "#111009", border: "none", borderRadius: "18px", padding: "20px", fontSize: "16px", fontWeight: "800", cursor: "pointer", fontFamily: "'Syne',sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", letterSpacing: "0.5px",
              boxShadow: "0 8px 32px #c9a84c44"
            }}>
              📷  Scan a Receipt
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} style={{ display: "none" }} />
          </div>

          <div style={{ padding: "0 20px" }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: muted, padding: "50px 0", fontSize: "15px" }}>
                {receipts.length === 0 ? "No receipts yet.\nTap scan to get started." : "No receipts in this category."}
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ fontSize: "10px", color: muted, letterSpacing: "3px", textTransform: "uppercase" }}>{filtered.length} receipt{filtered.length !== 1 ? "s" : ""}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", color: gold }}>${totalSpent.toFixed(2)}</div>
                </div>
                {filtered.map(r => <ReceiptCard key={r.id} receipt={r} onClick={() => { setCurrent(r); setView("detail"); }} />)}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SCAN ── */}
      {view === "scan" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: "40px 20px", textAlign: "center" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "50%", border: `3px solid ${gold}`, borderTopColor: "transparent", animation: "spin 1s linear infinite", marginBottom: "28px" }} />
          <div style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>Processing</div>
          <div style={{ color: muted, fontSize: "14px" }}>{scanStatus}</div>
        </div>
      )}

      {/* ── REVIEW ── */}
      {view === "review" && current && (
        <div className="fadeUp">
          <div style={{ padding: "24px 20px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: gold, fontSize: "22px", cursor: "pointer", padding: 0 }}>←</button>
            <div>
              <div style={{ fontSize: "10px", color: muted, letterSpacing: "3px", textTransform: "uppercase" }}>Step 1 of 3</div>
              <div style={{ fontSize: "22px", fontWeight: "800" }}>Review</div>
            </div>
          </div>

          <div style={{ padding: "0 20px" }}>
            {/* Extracted */}
            <div style={{ background: surface, borderRadius: "16px", padding: "16px", marginBottom: "14px" }}>
              <div style={{ fontSize: "10px", color: muted, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "4px" }}>Extracted Info</div>
              <Field label="Merchant" value={current.merchant} onChange={v => setCurrent(r => ({...r, merchant: v}))} placeholder="Store name" />
              <Field label="Date" value={current.date} onChange={v => setCurrent(r => ({...r, date: v}))} type="date" />
              <Field label="Total" value={current.total} onChange={v => setCurrent(r => ({...r, total: v}))} type="number" prefix="$" />
              <Field label="Tax" value={current.tax} onChange={v => setCurrent(r => ({...r, tax: v}))} type="number" prefix="$" />
              <Field label="Tip" value={current.tip} onChange={v => setCurrent(r => ({...r, tip: v}))} type="number" prefix="$" />
              <SelectField label="Payment" value={current.payment_method} onChange={v => setCurrent(r => ({...r, payment_method: v}))} options={PAYMENT_METHODS} />
            </div>

            {/* Category */}
            <div style={{ background: surface, borderRadius: "16px", padding: "16px", marginBottom: "14px" }}>
              <div style={{ fontSize: "10px", color: muted, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "14px" }}>Step 2 — Category</div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                {[["business","💼","Business",blue],["personal","🏠","Personal",pink]].map(([val, icon, label, col]) => (
                  <button key={val} onClick={() => setCurrent(r => ({...r, category: val, subcategory: null}))} style={{
                    flex: 1, padding: "12px", borderRadius: "14px", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "14px", fontFamily: "'Syne',sans-serif",
                    background: current.category === val ? col : card,
                    color: current.category === val ? "#111009" : muted,
                    transition: "all 0.15s"
                  }}>{icon} {label}</button>
                ))}
              </div>
              {current.category && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {CATEGORIES[current.category].map(sub => (
                    <button key={sub} onClick={() => setCurrent(r => ({...r, subcategory: sub}))} style={{
                      padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer", fontSize: "12px", fontFamily: "'Syne',sans-serif", fontWeight: "500",
                      background: current.subcategory === sub ? (current.category === "business" ? `${blue}33` : `${pink}33`) : border,
                      color: current.subcategory === sub ? (current.category === "business" ? blue : pink) : muted,
                      transition: "all 0.12s"
                    }}>{sub}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ background: surface, borderRadius: "16px", padding: "16px", marginBottom: "14px" }}>
              <div style={{ fontSize: "10px", color: muted, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "14px" }}>Step 3 — Notes</div>
              <textarea
                value={current.note}
                onChange={e => setCurrent(r => ({...r, note: e.target.value}))}
                placeholder="What was this expense for?"
                style={{ width: "100%", background: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "12px", color: text, fontSize: "14px", minHeight: "80px", resize: "none", fontFamily: "'Syne',sans-serif", outline: "none" }}
              />
              {isSafari ? (
                <div style={{ marginTop: "10px", width: "100%", padding: "12px", borderRadius: "12px", background: card, color: muted, fontSize: "13px", textAlign: "center", lineHeight: "1.5" }}>
                  🎙️ Voice notes available on Android Chrome.<br/>
                  <span style={{ fontSize: "12px" }}>On iPhone, use the mic on your keyboard while typing above.</span>
                </div>
              ) : (
                <button
                  onClick={listening ? stopVoice : startVoice}
                  style={{ marginTop: "10px", width: "100%", padding: "12px", borderRadius: "12px", border: "none", cursor: "pointer", fontWeight: "700", fontFamily: "'Syne',sans-serif", fontSize: "14px", transition: "all 0.15s",
                    background: listening ? "#ff4444" : card,
                    color: listening ? "#fff" : muted
                  }}>
                  {listening ? "🔴 Tap to stop" : "🎙️ Add Voice Note"}
                </button>
              )}
              {current.voiceNote && (
                <div style={{ marginTop: "10px", padding: "12px", background: card, borderRadius: "10px", fontSize: "13px", color: text, fontStyle: "italic", lineHeight: "1.5" }}>
                  🎙️ "{current.voiceNote}"
                  <button onClick={() => setCurrent(r => ({...r, voiceNote: ""}))} style={{ float: "right", background: "none", border: "none", color: muted, cursor: "pointer", fontSize: "12px" }}>clear</button>
                </div>
              )}
            </div>

            {/* Location */}
            {current.location?.address && (
              <div style={{ background: surface, borderRadius: "16px", padding: "14px 16px", marginBottom: "14px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "18px" }}>📍</span>
                <div style={{ fontSize: "12px", color: muted, lineHeight: "1.5" }}>{current.location.address}</div>
              </div>
            )}

            <button onClick={saveReceipt} style={{
              width: "100%", background: gold, color: "#111009", border: "none", borderRadius: "18px", padding: "18px", fontSize: "16px", fontWeight: "800", cursor: "pointer", fontFamily: "'Syne',sans-serif", marginBottom: "14px",
              boxShadow: "0 8px 32px #c9a84c44"
            }}>
              Save Receipt ✓
            </button>
          </div>
        </div>
      )}

      {/* ── DETAIL ── */}
      {view === "detail" && current && (
        <div className="fadeUp">
          <div style={{ padding: "24px 20px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => { setCurrent(null); setView("home"); }} style={{ background: "none", border: "none", color: gold, fontSize: "22px", cursor: "pointer", padding: 0 }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "10px", color: muted, letterSpacing: "3px", textTransform: "uppercase" }}>Receipt</div>
              <div style={{ fontSize: "20px", fontWeight: "800" }}>{current.merchant || "Unknown"}</div>
            </div>
            <button onClick={() => deleteReceipt(current.id)} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: "20px" }}>🗑️</button>
          </div>

          <div style={{ padding: "0 20px" }}>
            <div style={{ background: surface, borderRadius: "16px", padding: "20px", marginBottom: "14px" }}>
              <div style={{ fontSize: "38px", fontWeight: "700", color: gold, fontFamily: "'JetBrains Mono',monospace" }}>
                ${parseFloat(current.total || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: "14px", color: muted, marginTop: "4px" }}>{current.date} · {current.payment_method || "Unknown payment"}</div>
              {(current.tax > 0 || current.tip > 0) && (
                <div style={{ marginTop: "10px", fontSize: "13px", color: muted }}>
                  {current.subtotal > 0 && <span>Subtotal ${parseFloat(current.subtotal).toFixed(2)} · </span>}
                  {current.tax > 0 && <span>Tax ${parseFloat(current.tax).toFixed(2)} · </span>}
                  {current.tip > 0 && <span>Tip ${parseFloat(current.tip).toFixed(2)}</span>}
                </div>
              )}
              {current.category && (
                <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
                  <span style={{ padding: "5px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", background: current.category === "business" ? `${blue}22` : `${pink}22`, color: current.category === "business" ? blue : pink }}>
                    {current.category === "business" ? "💼" : "🏠"} {current.category}
                  </span>
                  {current.subcategory && (
                    <span style={{ padding: "5px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", background: border, color: muted }}>{current.subcategory}</span>
                  )}
                </div>
              )}
            </div>

            {current.items?.length > 0 && (
              <div style={{ background: surface, borderRadius: "16px", padding: "16px", marginBottom: "14px" }}>
                <div style={{ fontSize: "10px", color: muted, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "12px" }}>Items</div>
                {current.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: i < current.items.length - 1 ? `1px solid ${border}` : "none", fontSize: "14px" }}>
                    <span>{item.name}{item.qty > 1 ? ` ×${item.qty}` : ""}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: gold }}>${parseFloat(item.price || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {(current.note || current.voiceNote) && (
              <div style={{ background: surface, borderRadius: "16px", padding: "16px", marginBottom: "14px" }}>
                <div style={{ fontSize: "10px", color: muted, letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>Notes</div>
                {current.note && <div style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: current.voiceNote ? "10px" : 0 }}>{current.note}</div>}
                {current.voiceNote && <div style={{ fontSize: "13px", fontStyle: "italic", color: muted, lineHeight: "1.5" }}>🎙️ "{current.voiceNote}"</div>}
              </div>
            )}

            {current.location?.address && (
              <div style={{ background: surface, borderRadius: "16px", padding: "14px 16px", marginBottom: "14px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span>📍</span>
                <div style={{ fontSize: "12px", color: muted, lineHeight: "1.5" }}>{current.location.address}</div>
              </div>
            )}

            <div style={{ fontSize: "11px", color: muted, textAlign: "center", padding: "8px 0 0" }}>
              Scanned {new Date(current.scannedAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
