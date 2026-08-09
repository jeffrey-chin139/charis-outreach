"use client";

import { Download, Printer, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { RESIDENTIAL_OUTCOMES, STREET_E_OUTCOMES } from "@/lib/types";

type View = "residential" | "street" | "master" | "status";
type Row = Record<string, string | number | boolean | null>;

export function AdminApp() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [view, setView] = useState<View>("residential");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Row[]>([]);
  const [filters, setFilters] = useState({ q: "", dateFrom: "", dateTo: "", outcome: "", volunteerName: "", block: "", unit: "" });
  const [message, setMessage] = useState("");
  const supabase = useMemo(() => createBrowserSupabase(), []);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      setMessage("Supabase environment variables are not configured yet.");
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setReady(true);
    });
  }, [supabase]);

  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, view]);

  async function signIn() {
    if (!supabase) return;
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }
    setSignedIn(true);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSignedIn(false);
  }

  async function load() {
    const endpoint = view === "street" ? "/api/admin/street-e" : view === "master" ? "/api/admin/master" : view === "status" ? "/api/admin/unit-status" : "/api/admin/residential-visits";
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    const response = await fetch(`${endpoint}?${params}`);
    const data = await response.json();
    setRows(data.rows ?? []);
    setSummary(sortSummary(data.summary ?? [], view));
    if (!response.ok) setMessage(data.error ?? "Could not load admin data.");
  }

  async function exportCsv() {
    const params = new URLSearchParams({ view, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) });
    window.location.href = `/api/admin/export?${params}`;
  }

  if (!ready) return <main className="admin-shell">Loading...</main>;

  if (!supabase) {
    return (
      <main className="admin-shell">
        <section className="admin-login">
          <ShieldCheck size={34} />
          <h1>Charis Outreach Admin</h1>
          <p className="error-text">{message}</p>
        </section>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="admin-shell">
        <section className="admin-login">
          <ShieldCheck size={34} />
          <h1>Charis Outreach Admin</h1>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
          <button className="primary" onClick={signIn}>Log in</button>
          {message ? <p className="error-text">{message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1>Charis Outreach Admin</h1>
          <p>Search, correct, export, print, and manage master data.</p>
        </div>
        <button className="secondary" onClick={signOut}>Sign out</button>
      </header>

      <nav className="admin-tabs">
        {[
          ["residential", "Residential Visits"],
          ["street", "Street E"],
          ["master", "Master List"],
          ["status", "Do Not Revisit"]
        ].map(([key, label]) => (
          <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key as View)}>{label}</button>
        ))}
      </nav>

      <section className="admin-tools">
        <input placeholder="Search" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
        <input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} />
        <input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} />
        <input placeholder="Outcome" value={filters.outcome} onChange={(event) => setFilters({ ...filters, outcome: event.target.value })} />
        <input placeholder="Volunteer" value={filters.volunteerName} onChange={(event) => setFilters({ ...filters, volunteerName: event.target.value })} />
        <input placeholder="Block" value={filters.block} onChange={(event) => setFilters({ ...filters, block: event.target.value })} />
        <input placeholder="Unit" value={filters.unit} onChange={(event) => setFilters({ ...filters, unit: event.target.value })} />
        <button className="secondary" onClick={load}><Search size={16} /> Search</button>
        <button className="secondary" onClick={exportCsv}><Download size={16} /> CSV</button>
        <button className="secondary" onClick={() => window.print()}><Printer size={16} /> Print</button>
      </section>

      {summary.length ? (
        <section className="summary-grid">
          {summary.map((item, index) => (
            <div key={index}>
              <strong>{String(item.count)}</strong>
              <span>{String(item.outcome ?? item.label)}</span>
            </div>
          ))}
        </section>
      ) : null}

      <DataTable rows={rows} reload={load} view={view} />
    </main>
  );
}

function DataTable({ rows, reload, view }: { rows: Row[]; reload: () => void; view: View }) {
  if (rows.length === 0) return <p className="empty">No records found.</p>;
  const headers = Object.keys(rows[0]).filter((header) => header !== "id");

  async function patch(id: string, field: string, value: unknown) {
    const endpoint = view === "master" ? "/api/admin/master" : view === "status" ? "/api/admin/unit-status" : view === "street" ? "/api/admin/street-e" : "/api/admin/residential-visits";
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: value })
    });
    reload();
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.id)}>
              {headers.map((header) => (
                <td key={header}>
                  {editable(header, view) ? (
                    header === "remarks" ? (
                      <textarea
                        className="admin-edit-textarea"
                        value={String(row[header] ?? "")}
                        onChange={(event) => patch(String(row.id), header, event.target.value)}
                      />
                    ) : (
                      <input
                        value={String(row[header] ?? "")}
                        onChange={(event) => patch(String(row.id), header, header === "active" || header === "do_not_revisit_active" ? event.target.value === "true" : event.target.value)}
                      />
                    )
                  ) : (
                    <CellValue header={header} value={row[header]} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellValue({ header, value }: { header: string; value: Row[string] }) {
  if (header.includes("timestamp") && value) {
    const date = new Date(String(value));
    const yyyyMmDd = date.toLocaleDateString("en-CA");
    const hhMmSs = date.toLocaleTimeString("en-GB", { hour12: false });
    return (
      <span className="timestamp-cell">
        <span>{yyyyMmDd}</span>
        <span>{hhMmSs}</span>
      </span>
    );
  }

  return <span className={header === "remarks" ? "remarks-cell" : undefined}>{String(value ?? "")}</span>;
}

function sortSummary(summary: Row[], view: View) {
  const order = view === "street" ? STREET_E_OUTCOMES : RESIDENTIAL_OUTCOMES;
  const countByOutcome = new Map(summary.map((item) => [String(item.outcome ?? item.label), Number(item.count ?? 0)]));

  if (view !== "residential" && view !== "street") return summary;

  return order.map((outcome) => ({
    outcome,
    count: countByOutcome.get(outcome) ?? 0
  }));
}

function editable(header: string, view: View) {
  if (["id", "created_at", "updated_at", "visit_timestamp", "encounter_timestamp"].includes(header)) return false;
  if (view === "residential") return ["outcome", "remarks"].includes(header);
  if (view === "street") return ["outcome", "location", "remarks"].includes(header);
  if (view === "master") return ["neighbourhood", "block", "floor", "stack", "active"].includes(header);
  if (view === "status") return ["do_not_revisit_active", "reason"].includes(header);
  return false;
}
