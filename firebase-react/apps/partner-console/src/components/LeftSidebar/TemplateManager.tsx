import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

type TemplateItem = {
  id: string;
  name: string;
  description: string;
  schema: any;
  uiSchema: any;
  createdAt?: any;
  updatedAt?: any;
};

export default function TemplateManager() {
  const { setLog, busy, setBusy } = useAppContext();
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSchema, setNewSchema] = useState("");
  const [newUiSchema, setNewUiSchema] = useState("");

  const auth = getAuth();
  const user = auth.currentUser;

  async function refreshTemplates() {
    try {
      const res = await getApi().get("/v1/partner/templates");
      setItems(res.items || []);
    } catch (error: any) {
      setLog(`[Template] 템플릿 목록 조회 실패: ${error.message}`);
    }
  }

  useEffect(() => {
    if (user) {
      refreshTemplates();
    }
  }, [user]);

  async function handleCreateTemplate() {
    if (!user) {
      setLog("[Template] 로그인된 사용자 정보가 없습니다.");
      return;
    }
    if (!newName || !newSchema) {
      setLog("[Template] 템플릿 이름과 스키마(JSON)를 입력하세요.");
      return;
    }

    let parsedSchema = {};
    let parsedUiSchema = {};
    try {
      parsedSchema = JSON.parse(newSchema);
      if (newUiSchema) {
        parsedUiSchema = JSON.parse(newUiSchema);
      }
    } catch (e) {
      setLog("[Template] 스키마 또는 UI 스키마가 올바른 JSON 형식이 아닙니다.");
      return;
    }

    setBusy(true);
    setLog("[Template] 템플릿 등록 요청 중...");

    try {
      const res = await getApi().post("/v1/partner/templates", {
        name: newName,
        description: newDescription,
        schema: parsedSchema,
        uiSchema: parsedUiSchema,
      });
      
      if (res.id) {
        setLog("[Template] 템플릿이 성공적으로 등록되었습니다.");
        setNewName("");
        setNewDescription("");
        setNewSchema("");
        setNewUiSchema("");
        await refreshTemplates();
      } else {
        setLog(`[Template] 템플릿 등록 응답 오류: ${JSON.stringify(res)}`);
      }
    } catch (error: any) {
      setLog(`[Template] 템플릿 등록 실패: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(templateId: string) {
    if (!window.confirm("정말로 이 템플릿을 삭제하시겠습니까?")) return;

    setBusy(true);
    setLog("[Template] 템플릿 삭제 요청 중...");
    try {
      await getApi().delete(`/v1/partner/templates/${templateId}`);
      setLog("[Template] 템플릿이 삭제되었습니다.");
      await refreshTemplates();
    } catch (error: any) {
      setLog(`[Template] 템플릿 삭제 실패: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--pc-text)" }}>새 템플릿 등록</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--pc-surface)", padding: 24, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
          <input 
            value={newName} 
            onChange={(e: any) => setNewName(e.target.value)} 
            placeholder="템플릿 이름 (예: 기본 고객 양식)" 
            className="pc-input"
          />
          <input 
            value={newDescription} 
            onChange={(e: any) => setNewDescription(e.target.value)} 
            placeholder="설명 (선택 사항)" 
            className="pc-input"
          />
          <textarea 
            value={newSchema} 
            onChange={(e: any) => setNewSchema(e.target.value)} 
            placeholder={'Schema JSON (예: {"type": "object", "properties": {}})'} 
            className="pc-input pc-mono"
            style={{ minHeight: "120px", resize: "vertical" }}
          />
          <textarea 
            value={newUiSchema} 
            onChange={(e: any) => setNewUiSchema(e.target.value)} 
            placeholder={'UI Schema JSON (선택 사항)'} 
            className="pc-input pc-mono"
            style={{ minHeight: "80px", resize: "vertical" }}
          />
          <button onClick={handleCreateTemplate} disabled={busy || !newName || !newSchema} className="pc-btn pc-btn-brand" style={{ alignSelf: "flex-start", marginTop: 8 }}>
            새 템플릿 등록
          </button>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: "var(--pc-text)" }}>등록된 템플릿 목록</div>
        {items.length === 0 ? (
          <div style={{ color: "var(--pc-text-muted)", fontSize: 14, background: "var(--pc-surface)", padding: 24, borderRadius: "var(--pc-radius)", textAlign: "center", border: "1px solid var(--pc-border)" }}>
            등록된 템플릿이 없습니다.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {items?.map((t) => (
              <div key={t.id} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20, border: "1px solid var(--pc-border)", borderRadius: "var(--pc-radius)", background: "var(--pc-bg)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: "var(--pc-text)" }}>{t.name}</span>
                  <button onClick={() => handleDelete(t.id)} disabled={busy} className="pc-btn pc-btn-danger">
                    삭제
                  </button>
                </div>
                {t.description && <div style={{ fontSize: 14, color: "var(--pc-text-muted)" }}>{t.description}</div>}
                
                <div style={{ display: "grid", gridTemplateColumns: t.uiSchema && Object.keys(t.uiSchema).length > 0 ? "1fr 1fr" : "1fr", gap: 16, marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--pc-text-muted)", background: "var(--pc-surface)", padding: 12, borderRadius: "var(--pc-radius)", overflowX: "auto", border: "1px solid var(--pc-border)" }}>
                    <strong style={{ color: "var(--pc-text)", display: "block", marginBottom: 8 }}>Schema:</strong>
                    <pre className="pc-mono" style={{ margin: 0 }}>{JSON.stringify(t.schema, null, 2)}</pre>
                  </div>
                  {t.uiSchema && Object.keys(t.uiSchema).length > 0 && (
                    <div style={{ fontSize: 12, color: "var(--pc-text-muted)", background: "var(--pc-surface)", padding: 12, borderRadius: "var(--pc-radius)", overflowX: "auto", border: "1px solid var(--pc-border)" }}>
                      <strong style={{ color: "var(--pc-text)", display: "block", marginBottom: 8 }}>UI Schema:</strong>
                      <pre className="pc-mono" style={{ margin: 0 }}>{JSON.stringify(t.uiSchema, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
