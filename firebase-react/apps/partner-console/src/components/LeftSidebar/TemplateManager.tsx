import { useEffect, useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
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
    <div style={{ marginTop: 24, padding: 16, border: "1px solid #ccc", borderRadius: 8, background: "#fafafa" }}>
      <h3 style={{ margin: "0 0 12px" }}>폼 템플릿 관리</h3>
      <p style={{ fontSize: "0.9em", color: "#555", marginBottom: 12 }}>
        사용자에게 제공할 폼 빌더 템플릿(JSON Schema)을 등록하고 관리하세요.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <Input 
          value={newName} 
          onChange={(e: any) => setNewName(e.target.value)} 
          placeholder="템플릿 이름 (예: 기본 고객 양식)" 
        />
        <Input 
          value={newDescription} 
          onChange={(e: any) => setNewDescription(e.target.value)} 
          placeholder="설명 (선택 사항)" 
        />
        <textarea 
          value={newSchema} 
          onChange={(e: any) => setNewSchema(e.target.value)} 
          placeholder={'Schema JSON (예: {"type": "object", "properties": {}})'} 
          style={{ minHeight: "80px", fontFamily: "monospace", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <textarea 
          value={newUiSchema} 
          onChange={(e: any) => setNewUiSchema(e.target.value)} 
          placeholder={'UI Schema JSON (선택 사항)'} 
          style={{ minHeight: "60px", fontFamily: "monospace", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
        />
        <Button variant="primary" onClick={handleCreateTemplate} disabled={busy || !newName || !newSchema}>
          새 템플릿 등록
        </Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontWeight: "bold" }}>등록된 템플릿 목록</div>
        {items.length === 0 ? (
          <div style={{ color: "#666", fontSize: "0.9em" }}>등록된 템플릿이 없습니다.</div>
        ) : (
          items.map((t) => (
            <div key={t.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: "bold" }}>{t.name}</span>
                <Button variant="danger" size="sm" onClick={() => handleDelete(t.id)} disabled={busy}>
                  삭제
                </Button>
              </div>
              {t.description && <div style={{ fontSize: "0.85em", color: "#666" }}>{t.description}</div>}
              <div style={{ fontSize: "0.8em", color: "#444", background: "#f5f5f5", padding: 8, borderRadius: 4, overflowX: "auto" }}>
                <strong>Schema:</strong>
                <pre style={{ margin: "4px 0 0", fontFamily: "monospace" }}>{JSON.stringify(t.schema, null, 2)}</pre>
              </div>
              {t.uiSchema && Object.keys(t.uiSchema).length > 0 && (
                <div style={{ fontSize: "0.8em", color: "#444", background: "#f5f5f5", padding: 8, borderRadius: 4, overflowX: "auto" }}>
                  <strong>UI Schema:</strong>
                  <pre style={{ margin: "4px 0 0", fontFamily: "monospace" }}>{JSON.stringify(t.uiSchema, null, 2)}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
