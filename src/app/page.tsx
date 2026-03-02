"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Play,
  CheckCircle2,
  AlertCircle,
  Download,
  Loader2,
  Terminal as TerminalIcon,
  Search,
  Check,
  Settings,
  Database,
  Cpu,
  Monitor,
  ShieldCheck,
  ChevronRight,
  UserCircle,
  FileSpreadsheet,
  Activity,
  Trash2,
  DatabaseZap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LogEntry { id: string; msg: string; type: "info" | "success" | "warning" | "error"; time: string; }

interface Student {
  admission_no: string;
  mid1: string;
  mid2: string;
  assessment: string;
  uploaded_status?: string;
  [key: string]: string | undefined;
}

export default function OnexDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [credentials, setCredentials] = useState({ user: "", pass: "" });
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [context, setContext] = useState({
    programType: "UG",
    courseId: "BCSE",
    course: "B.Tech. (Computer Science and Engg) (NXT WAVE)",
    examSeries: "DEC-25",
    semester: "I Semester",
    markType: "Theory Internal",
    subject: "Web Application Development I"
  });

  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const addLog = (msg: string, type: LogEntry["type"] = "info") => {
    if (msg.startsWith("SYNC_UPDATE:")) {
      const ids = msg.replace("SYNC_UPDATE:", "").split(",");
      setStudents(prev => prev.map(s => ids.includes(s.admission_no) ? { ...s, uploaded_status: "YES" } : s));
      return;
    }
    setLogs(prev => [...prev, { id: Math.random().toString(36), msg, type, time: new Date().toLocaleTimeString() }]);
  };

  const resetAll = () => {
    setStudents([]);
    setFile(null);
    setLogs([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    addLog("✨ Dashboard reset. File buffers cleared.", "success");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;

        // ✨ Standard-Compliant CSV Parser
        // Safely handles newlines, quotes, commas without breaking the matrix
        const rows: string[][] = [];
        let row: string[] = [];
        let cell = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
          let char = text[i];
          if (inQuotes) {
            if (char === '"' && text[i + 1] === '"') {
              cell += '"';
              i++;
            } else if (char === '"') {
              inQuotes = false;
            } else {
              cell += char;
            }
          } else {
            if (char === '"') {
              inQuotes = true;
            } else if (char === ',') {
              row.push(cell.trim());
              cell = '';
            } else if (char === '\n' || char === '\r') {
              if (char === '\r' && text[i + 1] === '\n') i++;
              row.push(cell.trim());
              cell = '';
              rows.push(row);
              row = [];
            } else {
              cell += char;
            }
          }
        }
        if (cell || row.length > 0) {
          row.push(cell.trim());
          rows.push(row);
        }

        const allRows = rows.filter(r => r.some(c => c.length > 0)); // Remove perfectly empty rows

        // 1. Locate exactly where "Admission" starts
        let headerIdx = -1;
        for (let i = 0; i < Math.min(allRows.length, 20); i++) {
          if (allRows[i].some(c => c.toLowerCase().replace(/\n/g, " ").includes("admission"))) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          addLog("❌ Mapping Error: Could not find ANY row containing 'Admission'.", "error");
          return;
        }

        // 2. Discover Exact Column Indices
        // By scanning the header row and the immediate next row, we completely resolve merged-cell shifts.
        let cAdm = -1, cM1 = -1, cM2 = -1, cAsg = -1, cStat = -1;

        for (let i = headerIdx; i <= headerIdx + 1 && i < allRows.length; i++) {
          const hrow = allRows[i];
          for (let c = 0; c < hrow.length; c++) {
            let h = hrow[c].toLowerCase().replace(/\n/g, " ");

            if (h.includes("admission") || h.includes("roll")) { if (cAdm === -1) cAdm = c; }
            else if (h.includes("mid 1") || h.includes("mid1") || h.includes("m1") || h.includes("internal 1")) { if (cM1 === -1) cM1 = c; }
            else if (h.includes("mid 2") || h.includes("mid2") || h.includes("m2") || h.includes("internal 2")) { if (cM2 === -1) cM2 = c; }
            else if (h.includes("assign") || h.includes("assess")) { if (cAsg === -1) cAsg = c; }
            else if (h.includes("upload") || h.includes("status")) { if (cStat === -1) cStat = c; }
          }
        }

        // 3. Pinpoint Extract Data without loose fallbacks
        const data = [];
        for (let i = headerIdx + 1; i < allRows.length; i++) {
          const r = allRows[i];
          if (r.length < 3) continue;

          let adm = cAdm !== -1 && r[cAdm] ? r[cAdm] : "";
          if (!adm || adm.length < 3 || adm.toLowerCase().includes("admission") || adm.toLowerCase().includes("name")) continue;

          let m1 = cM1 !== -1 && r[cM1] !== undefined ? r[cM1].replace(/\n|\r/g, "").trim() : "";
          let m2 = cM2 !== -1 && r[cM2] !== undefined ? r[cM2].replace(/\n|\r/g, "").trim() : "";
          let asg = cAsg !== -1 && r[cAsg] !== undefined ? r[cAsg].replace(/\n|\r/g, "").trim() : "";
          let stat = cStat !== -1 && r[cStat] !== undefined ? r[cStat].toLowerCase() : "";

          data.push({
            admission_no: adm,
            mid1: m1,
            mid2: m2,
            assessment: asg,
            uploaded_status: (stat.includes("yes") || stat.includes("done") || stat.includes("true")) ? "YES" : ""
          });
        }

        setStudents(data);

        addLog(`📊 Header row confirmed at index ${headerIdx}:`, "info");
        addLog(`📌 [ID]: Col ${cAdm >= 0 ? cAdm + 1 : "?"} | [MID1]: Col ${cM1 >= 0 ? cM1 + 1 : "?"} | [MID2]: Col ${cM2 >= 0 ? cM2 + 1 : "?"}`, "info");
        addLog(`📌 [ASGN]: Col ${cAsg >= 0 ? cAsg + 1 : "?"} | [STATUS]: Col ${cStat >= 0 ? cStat + 1 : "?"}`, "info");

        if (data.length > 0) {
          addLog(`✅ FULLY RESOLVED: Strictly parsed ${data.length} student marks from direct arrays!`, "success");
        } else {
          addLog(`❌ ERROR: Headers found but no student values located underneath.`, "error");
        }
      };
      reader.readAsText(f);
    }
  };

  const startAutomation = async () => {
    if (!credentials.user || !credentials.pass) return addLog("❌ Enter Onex Credentials.", "error");
    setIsRunning(true);
    setLogs([]);
    addLog(`🚀 Syncing for: ${context.subject}...`, "info");

    abortControllerRef.current = new AbortController();

    try {
      const resp = await fetch("/api/automation", {
        method: "POST",
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({ students, credentials, context }),
      });
      const reader = resp.body?.getReader();
      if (!reader) return;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        text.split("\n\n").filter(Boolean).forEach(ev => {
          try { const d = JSON.parse(ev.replace("data: ", "")); addLog(d.msg, d.type); } catch (e) { }
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addLog("🛑 Sync forcefully aborted by user.", "warning");
      } else {
        addLog(`❌ Fetch error: ${err.message}`, "error");
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const forceStop = () => {
    if (abortControllerRef.current) {
      addLog("🛑 Halting automation engine...", "warning");
      abortControllerRef.current.abort();
    }
  };

  const downloadUpdatedCsv = () => {
    const headerRow = "Admission Number,Marks Obtained MID 1,MARKS OBTAINED IN MID 2,Assignment Marks,UPLOADED STATUS";
    const dataRows = students.map(s => `"${s.admission_no}","${s.mid1}","${s.mid2}","${s.assessment}","${s.uploaded_status || ""}"`).join("\n");
    const blob = new Blob([headerRow + "\n" + dataRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cdu_report.csv`; a.click();
  };

  const completedCount = students.filter(s => s.uploaded_status === "YES").length;
  const pendingCount = students.length - completedCount;

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100 font-sans p-6 overflow-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#6d28d9]/20 blur-[150px] rounded-full animate-pulse focus-within:animate-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#2563eb]/20 blur-[150px] rounded-full animate-float"></div>
      </div>

      <div className="max-w-[1500px] mx-auto relative z-10 h-[calc(100vh-3rem)] flex flex-col gap-6">
        <header className="flex flex-col md:flex-row justify-between items-center bg-white/5 border border-white/10 p-6 rounded-[2rem] glass shadow-2xl">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-gradient-to-br from-[#6d28d9] to-[#fbbf24] rounded-2xl shadow-lg ring-1 ring-white/20">
              <DatabaseZap size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-[gradient_8s_linear_infinite]">CDU Onex Dashboard</h1>
              <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-0.5"><ShieldCheck size={14} className="text-[#fbbf24]" /> High-Level Automation System</div>
            </div>
          </div>
          <div className="flex gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-3xl shadow-inner">
            <input type="text" placeholder="Username" className="bg-transparent border-none py-1.5 text-xs outline-none focus:ring-0 w-24 px-3" value={credentials.user} onChange={e => setCredentials({ ...credentials, user: e.target.value })} />
            <div className="w-px h-5 bg-white/10 my-auto"></div>
            <input type="password" placeholder="Password" className="bg-transparent border-none py-1.5 text-xs outline-none focus:ring-0 w-24 px-3" value={credentials.pass} onChange={e => setCredentials({ ...credentials, pass: e.target.value })} />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          <aside className="lg:col-span-3 flex flex-col glass rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-[#fbbf24] flex items-center gap-2">
              <Settings size={14} /> Subject Context
            </div>
            <div className="p-6 flex flex-col gap-4 overflow-auto scrollbar-thin">
              {Object.entries(context).map(([key, value]) => (
                <div key={key}>
                  <label className="text-[9px] text-slate-500 font-black uppercase mb-1.5 block">{key.replace(/([A-Z])/g, ' $1')}</label>
                  <input type="text" value={value} onChange={(e) => setContext({ ...context, [key]: e.target.value })} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 ring-purple-500/50 text-slate-200 font-medium whitespace-nowrap overflow-hidden text-ellipsis shadow-inner" />
                </div>
              ))}
            </div>
          </aside>

          <section className="lg:col-span-6 flex flex-col gap-6 h-full min-h-0">
            <div className="bg-white/5 border border-white/10 p-4 rounded-[3rem] glass flex items-center gap-4 shadow-xl">
              <label className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 px-6 py-4 rounded-[2rem] text-[11px] font-black uppercase transition cursor-pointer shadow-lg active:scale-95">
                <FileSpreadsheet size={18} className="text-[#fbbf24]" /> Load Sheet
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
              </label>

              {!isRunning ? (
                <button onClick={startAutomation} disabled={students.length === 0 || pendingCount === 0}
                  className={cn("flex-1 px-8 py-4 rounded-[2rem] text-[11px] font-black uppercase transition shadow-lg active:scale-95", pendingCount === 0 ? "bg-slate-800 text-slate-600 cursor-not-allowed" : "bg-gradient-to-r from-[#6d28d9] to-[#2563eb] border border-white/20 shadow-[0_0_20px_rgba(109,40,217,0.3)] hover:opacity-90")}
                >
                  {pendingCount === 0 && students.length > 0 ? "All Synced" : completedCount > 0 ? "Resume Sync" : "Sync Marks"}
                </button>
              ) : (
                <button onClick={forceStop}
                  className="flex-1 px-8 py-4 rounded-[2rem] text-[11px] font-black uppercase transition shadow-lg active:scale-95 bg-gradient-to-r from-rose-600 to-red-600 border border-white/20 shadow-[0_0_20px_rgba(225,29,72,0.4)] animate-pulse hover:animate-none"
                >
                  Force Stop
                </button>
              )}

              <button
                onClick={downloadUpdatedCsv}
                disabled={students.length === 0}
                className="p-4 bg-emerald-600/10 border border-emerald-600/20 rounded-[2rem] hover:bg-emerald-600/20 transition text-emerald-500 flex items-center gap-2 px-6 group disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download Results CSV"
              >
                <Download size={20} className="group-hover:-translate-y-1 transition" />
                <span className="text-[10px] font-black uppercase">Export</span>
              </button>

              <button
                onClick={resetAll}
                className="p-4 bg-red-600/10 border border-red-600/20 rounded-[2rem] hover:bg-red-600/20 transition text-red-500 flex items-center gap-2 px-6 group"
                title="Reset All Data"
              >
                <Trash2 size={20} className="group-hover:rotate-12 transition" />
                <span className="text-[10px] font-black uppercase">Clear</span>
              </button>
            </div>

            <div className="flex-1 glass rounded-[3rem] border border-white/10 overflow-hidden flex flex-col min-h-0 shadow-2xl">
              <div className="p-5 bg-white/5 border-b border-white/10 flex justify-between items-center px-8 backdrop-blur-xl">
                <h3 className="text-[11px] font-black tracking-widest text-slate-400 uppercase italic">Live Entry Preview</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-600" size={14} />
                  <input type="text" placeholder="Search ID..." value={search} onChange={e => setSearch(e.target.value)} className="bg-black/50 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs outline-none w-48 text-slate-100 shadow-inner" />
                </div>
              </div>
              <div className="flex-1 overflow-auto scrollbar-thin">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-[#0a0a0b]/95 backdrop-blur-md z-20">
                    <tr className="border-b border-white/10 text-[9px] font-black uppercase text-slate-600 tracking-widest">
                      <th className="p-6 px-10">Entry_ID</th>
                      <th className="p-6 text-center">MID_1</th>
                      <th className="p-6 text-center">MID_2</th>
                      <th className="p-6 text-center">ASGN</th>
                      <th className="p-6 text-right px-10">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {students.filter(s => s.admission_no.toLowerCase().includes(search.toLowerCase())).map((s, i) => (
                      <tr key={i} className="hover:bg-white/10 transition-colors group">
                        <td className="p-6 px-10 font-mono text-[11px] text-[#fbbf24]/70 group-hover:text-[#fbbf24] font-bold">{s.admission_no}</td>
                        <td className="p-6 text-center text-slate-100 font-bold group-hover:text-white">{s.mid1 || "—"}</td>
                        <td className="p-6 text-center text-slate-100 font-bold group-hover:text-white">{s.mid2 || "—"}</td>
                        <td className="p-6 text-center text-slate-100 font-bold group-hover:text-white">{s.assessment || "—"}</td>
                        <td className="p-6 text-right px-10">
                          {s.uploaded_status === "YES" ? <span className="text-emerald-400 text-[10px] font-black uppercase bg-emerald-500/10 px-4 py-1.5 rounded-xl border border-emerald-500/20 shadow-glow flex justify-end items-center gap-1.5"><CheckCircle2 size={12} /> Synced</span> : <span className="text-slate-500 text-[10px] font-black uppercase">Pending</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-3 flex flex-col gap-6 h-full min-h-0">
            <div className="flex-1 glass-dark rounded-[3rem] border border-white/10 overflow-hidden flex flex-col shadow-2xl">
              <div className="p-5 border-b border-white/10 bg-white/5 text-[10px] font-black uppercase text-slate-500 flex items-center gap-2 px-8">
                <Activity size={14} className="text-purple-400" /> System Log
              </div>
              <div className="flex-1 p-6 font-mono text-[10px] overflow-auto flex flex-col gap-2 scrollbar-thin">
                {logs.map(log => (
                  <div key={log.id} className={cn("leading-tight", log.type === "success" && "text-emerald-400 font-bold", log.type === "error" && "text-red-500 font-bold", log.type === "info" && "text-blue-300", log.type === "warning" && "text-yellow-400")}>
                    <span className="opacity-30 mr-2">[{log.time}]</span> {log.msg}
                  </div>
                ))}
              </div>
            </div>

            <div className="glass p-8 rounded-[3rem] border border-white/10 relative overflow-hidden shadow-2xl bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent">
              <div className="absolute -right-6 -bottom-6 opacity-5 rotate-12"><Activity size={100} /></div>
              <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest mb-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><DatabaseZap size={14} className="text-emerald-400" /> Batch Sync Status</span>
                <span className="text-[9px] text-slate-400 bg-black/40 px-3 py-1 rounded-full">{pendingCount} Pending</span>
              </p>
              <h4 className="text-4xl font-black text-emerald-400 tracking-tighter flex items-center gap-3">
                {completedCount} <span className="text-slate-700 text-sm font-bold mt-2">/ {students.length}</span>
              </h4>
              <div className="mt-5 w-full bg-black/40 rounded-full h-2 overflow-hidden border border-white/5 shadow-inner">
                <motion.div initial={{ width: 0 }}
                  animate={{ width: students.length > 0 ? `${(completedCount / students.length) * 100}%` : 0 }}
                  transition={{ type: "spring", stiffness: 50 }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
