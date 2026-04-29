import { useState, useEffect, useCallback } from "react";
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
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/v1/case-packs`);
      const json = await res.json();
      if (json.ok) {
        setPacks(json.data?.packs ?? []);
      } else {
        setError(json.error?.message || "데이터를 불러올 수 없습니다.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

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

    const stages = form.stagesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const requiredSlots = form.requiredSlotsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const baseUrl = getApiBaseUrl();
      const isEdit = editingId !== null;
      const path = isEdit ? `/v1/ops/case-packs/${editingId}` : "/v1/ops/case-packs";
      const method = isEdit ? "PUT" : "POST";
      const body = isEdit
        ? { nameKo: form.nameKo, category: form.category, active: form.active, formSchema: parsedSchema, workflow: { stages, requiredSlots } }
        : { id: form.id, nameKo: form.nameKo, category: form.category, active: form.active, formSchema: parsedSchema, workflow: { stages, requiredSlots } };

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.ok) {
        setFormSuccess(isEdit ? "수정 완료" : "생성 완료");
        fetchPacks();
        setTimeout(() => cancelForm(), 1200);
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
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>사건 팩 관리</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ar-btn ar-btn-sm ar-btn-ink" onClick={fetchPacks} disabled={loading}>
            {loading ? "불러오는 중..." : "새로고침"}
          </button>
          <button className="ar-btn ar-btn-sm ar-btn-accent" onClick={openCreate}>
            새 팩 생성
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: "var(--ar-danger)", fontSize: 13, padding: "12px 16px", background: "var(--ar-danger-soft)", borderRadius: "var(--ar-r1)" }}>
          {error}
        </div>
      )}

      {/* Section 1 — Case Pack Table */}
      <div className="ar-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ar-hairline)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>사건 팩 목록</h3>
          <span className="ar-badge ar-badge-accent">{packs.length}</span>
        </div>
        <table className="ar-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>이름</th>
              <th>카테고리</th>
              <th>상태</th>
              <th>단계 수</th>
              <th>필수 서류</th>
              <th>생성일</th>
              <th>수정</th>
            </tr>
          </thead>
          <tbody>
            {packs.length > 0 ? (
              packs.map((pack) => {
                const isExpanded = expandedId === pack.id;
                return (
                    <>
                    <tr
                      onClick={() => toggleExpand(pack.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="ar-mono" style={{ fontSize: 12 }}>{pack.id}</td>
                      <td className="ink" style={{ fontSize: 13 }}>{pack.nameKo}</td>
                      <td style={{ fontSize: 13 }}>{pack.category || "-"}</td>
                      <td>
                        <span className={`ar-badge ${pack.active ? "ar-badge-success" : "ar-badge-neutral"}`}>
                          {pack.active ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td className="ar-tabular" style={{ fontSize: 13 }}>{pack.workflow.stages.length}</td>
                      <td className="ar-tabular" style={{ fontSize: 13 }}>{pack.workflow.requiredSlots.length}</td>
                      <td className="ar-tabular" style={{ fontSize: 12, color: "var(--ar-slate)" }}>
                        {formatTimestamp(pack.createdAt)}
                      </td>
                      <td>
                        <button
                          className="ar-btn ar-btn-sm ar-btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(pack);
                          }}
                        >
                          수정
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0, borderBottom: "1px solid var(--ar-hairline)" }}>
                          <div style={{ padding: "16px 20px", background: "var(--ar-paper)", display: "flex", flexDirection: "column", gap: 16 }}>
                            {/* formSchema */}
                            <div>
                              <div className="ar-eyebrow" style={{ marginBottom: 8 }}>Form Schema</div>
                              <pre
                                className="ar-mono"
                                style={{
                                  fontSize: 12,
                                  lineHeight: 1.6,
                                  padding: 12,
                                  background: "var(--ar-canvas)",
                                  border: "1px solid var(--ar-hairline)",
                                  borderRadius: "var(--ar-r1)",
                                  overflow: "auto",
                                  maxHeight: 240,
                                  margin: 0,
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                }}
                              >
                                {JSON.stringify(pack.formSchema, null, 2)}
                              </pre>
                            </div>
                            {/* stages */}
                            <div>
                              <div className="ar-eyebrow" style={{ marginBottom: 8 }}>Workflow Stages</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {pack.workflow.stages.map((stage) => (
                                  <span key={stage} className="ar-badge ar-badge-accent">{stage}</span>
                                ))}
                                {pack.workflow.stages.length === 0 && (
                                  <span style={{ fontSize: 13, color: "var(--ar-fog)" }}>없음</span>
                                )}
                              </div>
                            </div>
                            {/* requiredSlots */}
                            <div>
                              <div className="ar-eyebrow" style={{ marginBottom: 8 }}>Required Slots</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {pack.workflow.requiredSlots.map((slot) => (
                                  <span key={slot} className="ar-badge ar-badge-info">{slot}</span>
                                ))}
                                {pack.workflow.requiredSlots.length === 0 && (
                                  <span style={{ fontSize: 13, color: "var(--ar-fog)" }}>없음</span>
                                )}
                              </div>
                            </div>
                            {/* checklists */}
                            {pack.workflow.checklists && Object.keys(pack.workflow.checklists).length > 0 && (
                              <div>
                                <div className="ar-eyebrow" style={{ marginBottom: 8 }}>Checklists</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {Object.entries(pack.workflow.checklists).map(([stageId, items]) => (
                                    <div key={stageId}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ar-ink)", marginBottom: 4 }}>{stageId}</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                        {items.map((item) => (
                                          <span key={item.itemId} className="ar-badge ar-badge-neutral" style={{ fontSize: 11 }}>
                                            {item.titleKo}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--ar-slate)" }}>
                  {loading ? "불러오는 중..." : "사건 팩이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Section 2 — Create/Edit Form */}
      {showForm && (
        <div className="ar-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px" }}>
            {editingId ? `팩 수정 — ${editingId}` : "새 팩 생성"}
          </h3>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
            {/* ID */}
            <div>
              <label className="ar-label" style={{ display: "block", marginBottom: 6 }}>ID</label>
              <input
                className="ar-input ar-input-sm"
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                placeholder="예: real_estate_transfer_v1"
                disabled={editingId !== null}
                style={{ opacity: editingId !== null ? 0.6 : 1 }}
              />
            </div>

            {/* 이름 */}
            <div>
              <label className="ar-label" style={{ display: "block", marginBottom: 6 }}>이름 (nameKo)</label>
              <input
                className="ar-input ar-input-sm"
                value={form.nameKo}
                onChange={(e) => setForm((f) => ({ ...f, nameKo: e.target.value }))}
                placeholder="예: 부동산 소유권 이전 등기"
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label className="ar-label" style={{ display: "block", marginBottom: 6 }}>카테고리</label>
              <input
                className="ar-input ar-input-sm"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="예: real_estate"
              />
            </div>

            {/* 활성 */}
            <div>
              <label className="ar-label" style={{ display: "block", marginBottom: 6 }}>활성</label>
              <div style={{ display: "flex", alignItems: "center", height: 36 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: "var(--ar-graphite)" }}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: "var(--ar-accent)" }}
                  />
                  {form.active ? "활성" : "비활성"}
                </label>
              </div>
            </div>
          </div>

          {/* formSchema */}
          <div style={{ marginTop: 16 }}>
            <label className="ar-label" style={{ display: "block", marginBottom: 6 }}>Form Schema (JSON)</label>
            <textarea
              className="ar-mono"
              value={form.formSchema}
              onChange={(e) => setForm((f) => ({ ...f, formSchema: e.target.value }))}
              style={{
                width: "100%",
                minHeight: 120,
                padding: 12,
                background: "var(--ar-canvas)",
                border: "1.5px solid var(--ar-hairline-strong)",
                borderRadius: "var(--ar-r1)",
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--ar-ink)",
                outline: "none",
                resize: "vertical",
                fontFamily: "var(--ar-font-mono)",
              }}
            />
          </div>

          {/* workflow fields */}
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
            <div>
              <label className="ar-label" style={{ display: "block", marginBottom: 6 }}>Workflow Stages (쉼표 구분)</label>
              <textarea
                className="ar-input"
                value={form.stagesText}
                onChange={(e) => setForm((f) => ({ ...f, stagesText: e.target.value }))}
                placeholder="docs_collect, docs_review, draft_filing, completed"
                style={{ height: 80, padding: 12, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
            <div>
              <label className="ar-label" style={{ display: "block", marginBottom: 6 }}>Required Slots (쉼표 구분)</label>
              <textarea
                className="ar-input"
                value={form.requiredSlotsText}
                onChange={(e) => setForm((f) => ({ ...f, requiredSlotsText: e.target.value }))}
                placeholder="slot_id_card, slot_real_estate_registry"
                style={{ height: 80, padding: 12, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
          </div>

          {/* Form feedback */}
          {formError && (
            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: "var(--ar-r1)",
                background: "var(--ar-danger-soft)",
                color: "var(--ar-danger)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ❌ {formError}
            </div>
          )}
          {formSuccess && (
            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: "var(--ar-r1)",
                background: "var(--ar-success-soft)",
                color: "var(--ar-success)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ✅ {formSuccess}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button
              className="ar-btn ar-btn-sm ar-btn-accent"
              onClick={saveForm}
              disabled={saving}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              className="ar-btn ar-btn-sm ar-btn-ghost"
              onClick={cancelForm}
              disabled={saving}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
