import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../apiBase";

// --- Types ---

interface FirestoreTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface CasePackWorkflow {
  stages: string[];
  requiredSlots: string[];
  checklists?: Record<string, { itemId: string; titleKo: string }[]>;
}

interface CasePack {
  id: string;
  category: string;
  nameKo: string;
  active: boolean;
  formSchema: {
    type: "object";
    properties: Record<string, unknown>;
  };
  workflow: CasePackWorkflow;
  createdAt: string | FirestoreTimestamp;
  updatedAt: string | FirestoreTimestamp;
}

// --- Helpers ---

function formatTimestamp(ts: unknown): string {
  if (!ts) return "-";
  if (typeof ts === "string")
    return new Date(ts).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (typeof ts === "object" && ts !== null && "_seconds" in ts)
    return new Date((ts as FirestoreTimestamp)._seconds * 1000).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  return "-";
}

function safeJsonParse(str: string): Record<string, unknown> | null {
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// --- Form State ---

interface FormState {
  id: string;
  nameKo: string;
  category: string;
  active: boolean;
  formSchema: string;
  stagesText: string;
  requiredSlotsText: string;
}

const EMPTY_FORM: FormState = {
  id: "",
  nameKo: "",
  category: "",
  active: true,
  formSchema: '{\n  "type": "object",\n  "properties": {}\n}',
  stagesText: "",
  requiredSlotsText: "",
};

function packToForm(pack: CasePack): FormState {
  return {
    id: pack.id,
    nameKo: pack.nameKo,
    category: pack.category,
    active: pack.active,
    formSchema: JSON.stringify(pack.formSchema, null, 2),
    stagesText: pack.workflow.stages.join(", "),
    requiredSlotsText: pack.workflow.requiredSlots.join(", "),
  };
}

// --- Component ---

export default function CasePacks() {
  const { token } = useAuth();
  const formTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // List state
  const [packs, setPacks] = useState<CasePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form (create / edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // --- Data Fetching ---

  const fetchPacks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${getApiBaseUrl()}/v1/case-packs`);
      const json = await res.json();
      if (json.ok) setPacks(json.data?.packs ?? []);
      else setError(json.error?.message || "데이터를 불러올 수 없습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  useEffect(() => {
    return () => { if (formTimerRef.current) clearTimeout(formTimerRef.current); };
  }, []);

  // --- Form Handlers ---

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
    setShowForm(true);
  }, []);

  const openEdit = useCallback((pack: CasePack) => {
    setEditingId(pack.id);
    setForm(packToForm(pack));
    setFormError(null);
    setFormSuccess(null);
    setShowForm(true);
  }, []);

  const cancelForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
  }, []);

  const saveForm = useCallback(async () => {
    if (!form.id.trim() || !form.nameKo.trim()) {
      setFormError("ID와 이름은 필수입니다.");
      return;
    }

    const parsedSchema = safeJsonParse(form.formSchema);
    if (!parsedSchema) {
      setFormError("formSchema JSON 형식이 올바르지 않습니다.");
      return;
    }

    const stages = form.stagesText.split(",").map((s) => s.trim()).filter(Boolean);
    const requiredSlots = form.requiredSlotsText.split(",").map((s) => s.trim()).filter(Boolean);

    setSaving(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const isEdit = editingId !== null;
      const path = isEdit ? `/v1/ops/case-packs/${editingId}` : "/v1/ops/case-packs";
      const method = isEdit ? "PUT" : "POST";
      const body = isEdit
        ? { nameKo: form.nameKo, category: form.category, active: form.active, formSchema: parsedSchema, workflow: { stages, requiredSlots } }
        : { id: form.id, nameKo: form.nameKo, category: form.category, active: form.active, formSchema: parsedSchema, workflow: { stages, requiredSlots } };

      const res = await fetch(`${getApiBaseUrl()}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.ok) {
        setFormSuccess(isEdit ? "수정 완료" : "생성 완료");
        fetchPacks();
        formTimerRef.current = setTimeout(() => cancelForm(), 1200);
      } else {
        setFormError(json.error?.messageKo || json.error?.message || "저장 실패");
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "요청 실패");
    } finally {
      setSaving(false);
    }
  }, [form, editingId, token, fetchPacks, cancelForm]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // --- Render ---

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="ops-title">사건 팩 관리</h1>
          <p className="ops-subtitle">시스템에 정의된 사건 팩 스키마와 워크플로우를 편집합니다.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ops-btn" onClick={fetchPacks} disabled={loading}>
            {loading ? "갱신 중..." : "↻ 새로고침"}
          </button>
          <button className="ops-btn ops-btn-brand" onClick={openCreate}>
            + 새 팩 생성
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: "var(--ops-danger)", fontSize: 13, padding: "12px 16px", background: "var(--ops-danger-soft)", borderRadius: "var(--ops-radius)" }}>
          {error}
        </div>
      )}

      {/* Case Pack Table */}
      <div className="ops-panel">
        <div className="ops-panel-header">
          <h3 className="ops-panel-title">등록된 사건 팩</h3>
          <span className="ops-badge ops-badge-brand">{packs.length}</span>
        </div>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>카테고리</th>
                <th>상태</th>
                <th>단계 수</th>
                <th>필수 서류</th>
                <th>생성일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {packs.length > 0 ? (
                packs.map((pack) => {
                  const isExpanded = expandedId === pack.id;
                  return (
                    <React.Fragment key={pack.id}>
                      <tr onClick={() => toggleExpand(pack.id)} style={{ cursor: "pointer", background: isExpanded ? "var(--ops-surface-hover)" : "transparent" }}>
                        <td className="ops-mono" style={{ fontSize: 11, color: "var(--ops-brand)" }}>{pack.id}</td>
                        <td style={{ fontWeight: 600 }}>{pack.nameKo}</td>
                        <td className="ops-mono" style={{ fontSize: 11, color: "var(--ops-text-muted)" }}>{pack.category || "-"}</td>
                        <td>
                          <span className={`ops-badge ${pack.active ? "ops-badge-success" : "ops-badge-neutral"}`}>
                            {pack.active ? "활성" : "비활성"}
                          </span>
                        </td>
                        <td className="ops-mono">{pack.workflow.stages.length}</td>
                        <td className="ops-mono">{pack.workflow.requiredSlots.length}</td>
                        <td className="ops-mono" style={{ fontSize: 11, color: "var(--ops-text-muted)" }}>
                          {formatTimestamp(pack.createdAt)}
                        </td>
                        <td>
                          <button className="ops-btn" onClick={(e) => { e.stopPropagation(); openEdit(pack); }}>
                            수정
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} style={{ padding: 0, borderBottom: "1px solid var(--ops-border)" }}>
                            <div style={{ padding: "16px 20px", background: "var(--ops-bg)", display: "flex", flexDirection: "column", gap: 16 }}>
                              {/* formSchema */}
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ops-text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Form Schema</div>
                                <pre className="ops-mono" style={{ fontSize: 11, lineHeight: 1.6, padding: 12, background: "var(--ops-surface)", border: "1px solid var(--ops-border)", borderRadius: "var(--ops-radius-sm)", overflow: "auto", maxHeight: 240, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                  {JSON.stringify(pack.formSchema, null, 2)}
                                </pre>
                              </div>
                              {/* stages */}
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ops-text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Workflow Stages</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {pack.workflow.stages.map((stage) => (
                                    <span key={stage} className="ops-badge ops-badge-brand">{stage}</span>
                                  ))}
                                  {pack.workflow.stages.length === 0 && <span style={{ fontSize: 12, color: "var(--ops-text-muted)" }}>없음</span>}
                                </div>
                              </div>
                              {/* requiredSlots */}
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ops-text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Required Slots</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {pack.workflow.requiredSlots.map((slot) => (
                                    <span key={slot} className="ops-badge ops-badge-warning">{slot}</span>
                                  ))}
                                  {pack.workflow.requiredSlots.length === 0 && <span style={{ fontSize: 12, color: "var(--ops-text-muted)" }}>없음</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--ops-text-muted)" }}>
                    {loading ? "불러오는 중..." : "사건 팩이 없습니다."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="ops-panel">
          <div className="ops-panel-header">
            <h3 className="ops-panel-title">{editingId ? `팩 수정 — ${editingId}` : "새 팩 생성"}</h3>
          </div>
          <div className="ops-panel-body">
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>ID</label>
                <input className="ops-input" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="예: real_estate_transfer_v1" disabled={editingId !== null} style={{ opacity: editingId !== null ? 0.6 : 1 }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>이름 (nameKo)</label>
                <input className="ops-input" value={form.nameKo} onChange={(e) => setForm((f) => ({ ...f, nameKo: e.target.value }))} placeholder="예: 부동산 소유권 이전 등기" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>카테고리</label>
                <input className="ops-input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="예: real_estate" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>상태</label>
                <div style={{ display: "flex", alignItems: "center", height: 28, gap: 8 }}>
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} style={{ width: 16, height: 16, accentColor: "var(--ops-brand)" }} />
                  <span style={{ fontSize: 13 }}>활성화</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>Form Schema (JSON)</label>
              <textarea
                className="ops-mono ops-input"
                value={form.formSchema}
                onChange={(e) => setForm((f) => ({ ...f, formSchema: e.target.value }))}
                style={{ height: 160, padding: 12, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>Workflow Stages (쉼표 구분)</label>
                <textarea className="ops-input" value={form.stagesText} onChange={(e) => setForm((f) => ({ ...f, stagesText: e.target.value }))} placeholder="docs_collect, docs_review, draft_filing, completed" style={{ height: 80, padding: 12, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ops-text-muted)" }}>Required Slots (쉼표 구분)</label>
                <textarea className="ops-input" value={form.requiredSlotsText} onChange={(e) => setForm((f) => ({ ...f, requiredSlotsText: e.target.value }))} placeholder="slot_id_card, slot_real_estate_registry" style={{ height: 80, padding: 12, resize: "vertical" }} />
              </div>
            </div>

            {formError && <div style={{ marginTop: 16, padding: 12, background: "var(--ops-danger-soft)", color: "var(--ops-danger)", fontSize: 13, borderRadius: "var(--ops-radius-sm)" }}>❌ {formError}</div>}
            {formSuccess && <div style={{ marginTop: 16, padding: 12, background: "var(--ops-success-soft)", color: "var(--ops-success)", fontSize: 13, borderRadius: "var(--ops-radius-sm)" }}>✅ {formSuccess}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
              <button className="ops-btn" onClick={cancelForm} disabled={saving}>취소</button>
              <button className="ops-btn ops-btn-brand" onClick={saveForm} disabled={saving}>{saving ? "저장 중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
