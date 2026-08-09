"use client";

import { Check, ChevronLeft, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  RESIDENTIAL_OUTCOMES,
  STREET_E_OUTCOMES,
  UNRECORDED,
  type GeneratedUnitState,
  type OutreachType,
  type ResidentialOutcome,
  type ResidentialUnit,
  type StreetEOutcome
} from "@/lib/types";

type Step = "start" | "residential-select" | "residential-record" | "street-e";
type Encounter = {
  encounterNumber: number;
  outcome: StreetEOutcome | typeof UNRECORDED;
  location: string;
  remarks: string;
  encounterId?: string;
  savedState?: "idle" | "saving" | "saved" | "draft" | "error";
};

export function VolunteerApp() {
  const [step, setStep] = useState<Step>("start");
  const [volunteerName, setVolunteerName] = useState("");
  const [outreachType, setOutreachType] = useState<OutreachType>("Haig Road");
  const [block, setBlock] = useState("");
  const [blocks, setBlocks] = useState<string[]>([]);
  const [floors, setFloors] = useState<string[]>([]);
  const [stacks, setStacks] = useState<string[]>([]);
  const [selectedFloors, setSelectedFloors] = useState<string[]>([]);
  const [selectedStacks, setSelectedStacks] = useState<string[]>([]);
  const [units, setUnits] = useState<GeneratedUnitState[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [streetSessionId, setStreetSessionId] = useState<string>();
  const [localPreview, setLocalPreview] = useState(false);
  const [filter, setFilter] = useState("All");
  const [encounters, setEncounters] = useState<Encounter[]>([{ encounterNumber: 1, outcome: UNRECORDED, location: "", remarks: "" }]);
  const [error, setError] = useState("");
  const [displayTime, setDisplayTime] = useState("");

  const residential = outreachType === "Haig Road" || outreachType === "Dakota";

  useEffect(() => {
    setDisplayTime(new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }));
  }, []);

  useEffect(() => {
    if (!residential) return;
    fetch(`/api/public/residential/options?neighbourhood=${encodeURIComponent(outreachType)}`)
      .then((res) => res.json())
      .then((data) => setBlocks(data.blocks ?? []))
      .catch(() => setError("Could not load blocks. Check that the app is running correctly."));
  }, [outreachType, residential]);

  useEffect(() => {
    if (!residential || !block) return;
    fetch(`/api/public/residential/options?neighbourhood=${encodeURIComponent(outreachType)}&block=${encodeURIComponent(block)}`)
      .then((res) => res.json())
      .then((data) => {
        setFloors(data.floors ?? []);
        setStacks(data.stacks ?? []);
        setSelectedFloors([]);
        setSelectedStacks([]);
      })
      .catch(() => setError("Could not load floors and stacks."));
  }, [block, outreachType, residential]);

  const visibleUnits = useMemo(() => {
    return units.filter((unit) => {
      if (filter === "All") return true;
      if (filter === "Unrecorded") return unit.outcome === UNRECORDED;
      if (filter.startsWith("Floor ")) return unit.floor === filter.replace("Floor ", "");
      if (filter.startsWith("Stack ")) return unit.stack === filter.replace("Stack ", "");
      return true;
    });
  }, [filter, units]);

  const recordedCount = units.filter((unit) => unit.outcome !== UNRECORDED).length;

  function goBack() {
    setError("");
    setStep(step === "residential-record" ? "residential-select" : "start");
  }

  function resetSavedSessionState() {
    setSessionId(undefined);
    setStreetSessionId(undefined);
    setUnits([]);
    setEncounters([{ encounterNumber: 1, outcome: UNRECORDED, location: "", remarks: "" }]);
  }

  function start() {
    setError("");
    if (!volunteerName.trim()) {
      setError("Enter your name first.");
      return;
    }
    if (outreachType === "Street E") {
      setStep("street-e");
      return;
    }
    setStep("residential-select");
  }

  async function generateUnits() {
    setError("");
    const response = await fetch("/api/public/residential/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volunteerName, neighbourhood: outreachType, block, floors: selectedFloors, stacks: selectedStacks })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not generate units.");
      return;
    }
    setUnits(
      (data.units as ResidentialUnit[]).map((unit) => ({
        ...unit,
        outcome: UNRECORDED,
        remarks: "",
        savedState: "idle"
      }))
    );
    setLocalPreview(Boolean(data.localOnly));
    setFilter("All");
    setStep("residential-record");
  }

  async function saveResidential(index: number, patch: Partial<GeneratedUnitState>) {
    const next = [...units];
    next[index] = { ...next[index], ...patch };
    setUnits(next);

    const unit = next[index];
    if (unit.outcome === UNRECORDED) return;

    if (localPreview) {
      setUnits((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index ? { ...item, savedState: "draft", doNotRevisit: item.doNotRevisit || item.outcome === "Do not revisit" } : item
        )
      );
      return;
    }

    setUnits((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, savedState: "saving" } : item)));
    const response = await fetch("/api/public/residential/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        volunteerName,
        neighbourhood: unit.neighbourhood,
        block: unit.block,
        masterId: unit.id,
        outcome: unit.outcome,
        remarks: unit.remarks,
        existingVisitId: unit.visitId
      })
    });
    const data = await response.json();

    setUnits((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, visitId: data.visitId ?? item.visitId, savedState: response.ok ? "saved" : "error", doNotRevisit: item.doNotRevisit || item.outcome === "Do not revisit" }
          : item
      )
    );
    if (data.sessionId) setSessionId(data.sessionId);
    if (!response.ok) setError(data.error ?? "Could not save visit.");
  }

  async function saveEncounter(index: number, patch: Partial<Encounter>) {
    const next = [...encounters];
    next[index] = { ...next[index], ...patch };
    setEncounters(next);

    const encounter = next[index];
    if (encounter.outcome === UNRECORDED) return;

    setEncounters((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, savedState: "saving" } : item)));
    const response = await fetch("/api/public/street-e/encounters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: streetSessionId,
        volunteerName,
        encounterNumber: encounter.encounterNumber,
        outcome: encounter.outcome,
        location: encounter.location,
        remarks: encounter.remarks,
        existingEncounterId: encounter.encounterId
      })
    });
    const data = await response.json();
    if (response.status === 503) {
      setEncounters((current) =>
        current.map((item, itemIndex) => (itemIndex === index ? { ...item, savedState: "draft" } : item))
      );
      return;
    }

    setEncounters((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, encounterId: data.encounterId ?? item.encounterId, savedState: response.ok ? "saved" : "error" } : item
      )
    );
    if (data.sessionId) setStreetSessionId(data.sessionId);
    if (!response.ok) setError(data.error ?? "Could not save encounter.");
  }

  return (
    <main className="app-shell">
      <section className="volunteer-panel">
        <header className="topbar">
          {step !== "start" ? (
            <button className="icon-button" aria-label="Go back" onClick={goBack}>
              <ChevronLeft size={22} />
            </button>
          ) : null}
          <div>
            <h1>Charis Outreach</h1>
            <p>{displayTime}</p>
          </div>
        </header>

        {error ? <div className="error">{error}</div> : null}

        {step === "start" ? (
          <div className="stack">
            <label>
              Volunteer / Surveyor Name
              <input
                value={volunteerName}
                onChange={(event) => {
                  setVolunteerName(event.target.value);
                  resetSavedSessionState();
                }}
                placeholder="Enter name"
                autoFocus
              />
            </label>
            <div>
              <span className="field-label">Outreach type</span>
              <div className="segmented">
                {(["Haig Road", "Dakota", "Street E"] as OutreachType[]).map((type) => (
                  <button
                    key={type}
                    className={outreachType === type ? "active" : ""}
                    onClick={() => {
                      setOutreachType(type);
                      resetSavedSessionState();
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <button className="primary" onClick={start}>
              Continue
            </button>
          </div>
        ) : null}

        {step === "residential-select" ? (
          <div className="stack">
            <label>
              Block
              <select value={block} onChange={(event) => setBlock(event.target.value)}>
                <option value="">Select block</option>
                {blocks.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <MultiSelect title="Floors" values={floors} selected={selectedFloors} onChange={setSelectedFloors} />
            <MultiSelect title="Stacks" values={stacks} selected={selectedStacks} onChange={setSelectedStacks} />
            <button className="primary" disabled={!block || selectedFloors.length === 0 || selectedStacks.length === 0} onClick={generateUnits}>
              Generate Units
            </button>
          </div>
        ) : null}

        {step === "residential-record" ? (
          <div className="stack">
            <div className="progress-row">
              <strong>{units.length}</strong>
              <span>Total</span>
              <strong>{recordedCount}</strong>
              <span>Recorded</span>
              <strong>{units.length - recordedCount}</strong>
              <span>Remaining</span>
            </div>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option>All</option>
              <option>Unrecorded</option>
              {selectedFloors.map((floor) => (
                <option key={`floor-${floor}`}>Floor {floor}</option>
              ))}
              {selectedStacks.map((stack) => (
                <option key={`stack-${stack}`}>Stack {stack}</option>
              ))}
            </select>
            <div className="record-list">
              {visibleUnits.map((unit) => {
                const index = units.findIndex((item) => item.id === unit.id);
                return (
                  <article key={unit.id} className={unit.doNotRevisit ? "record-card danger" : "record-card"}>
                    <div className="record-heading">
                      <strong>{unit.unitLabel}</strong>
                    </div>
                    {unit.doNotRevisit ? <div className="dnr">DO NOT REVISIT</div> : null}
                    <label>
                      <select value={unit.outcome} onChange={(event) => saveResidential(index, { outcome: event.target.value as ResidentialOutcome })}>
                        <option value={UNRECORDED}>Select Outcome</option>
                        {RESIDENTIAL_OUTCOMES.map((outcome) => (
                          <option key={outcome}>{outcome}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <textarea
                        value={unit.remarks}
                        maxLength={1000}
                        placeholder="Remarks [contact, background, needs, etc.]"
                        onChange={(event) => {
                          const nextUnits = [...units];
                          nextUnits[index] = { ...nextUnits[index], remarks: event.target.value };
                          setUnits(nextUnits);
                        }}
                        onBlur={(event) => saveResidential(index, { remarks: event.target.value })}
                      />
                    </label>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === "street-e" ? (
          <div className="stack">
            {encounters.map((encounter, index) => (
              <article key={encounter.encounterNumber} className="record-card">
                <div className="record-heading">
                  <strong>Encounter {encounter.encounterNumber}</strong>
                </div>
                <select value={encounter.outcome} onChange={(event) => saveEncounter(index, { outcome: event.target.value as StreetEOutcome })}>
                  <option value={UNRECORDED}>Select Outcome</option>
                  {STREET_E_OUTCOMES.map((outcome) => (
                    <option key={outcome}>{outcome}</option>
                  ))}
                </select>
                <input
                  value={encounter.location}
                  maxLength={120}
                  placeholder="Location"
                  onChange={(event) => {
                    const nextEncounters = [...encounters];
                    nextEncounters[index] = { ...nextEncounters[index], location: event.target.value };
                    setEncounters(nextEncounters);
                  }}
                  onBlur={(event) => saveEncounter(index, { location: event.target.value })}
                />
                <textarea
                  value={encounter.remarks}
                  maxLength={1000}
                  placeholder="Remarks [contact, background, needs, etc.]"
                  onChange={(event) => saveEncounter(index, { remarks: event.target.value })}
                />
              </article>
            ))}
            <button className="secondary" onClick={() => setEncounters((current) => [...current, { encounterNumber: current.length + 1, outcome: UNRECORDED, location: "", remarks: "" }])}>
              <Plus size={18} /> Add Encounter
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function MultiSelect({ title, values, selected, onChange }: { title: string; values: string[]; selected: string[]; onChange: (values: string[]) => void }) {
  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <div>
      <div className="multi-header">
        <span className="field-label">{title}</span>
        <div>
          <button className="mini" onClick={() => onChange(values)} aria-label={`Select all ${title.toLowerCase()}`}>
            <Check size={15} /> All
          </button>
          <button className="mini" onClick={() => onChange([])} aria-label={`Clear ${title.toLowerCase()}`}>
            <X size={15} /> Clear
          </button>
        </div>
      </div>
      <div className="chip-grid">
        {values.map((value) => (
          <button key={value} className={selected.includes(value) ? "chip selected" : "chip"} onClick={() => toggle(value)}>
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
