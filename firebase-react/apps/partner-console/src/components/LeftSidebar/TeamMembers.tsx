import { useState } from "react";
import { Button, Input } from "@agentregi/ui-components";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function TeamMembers() {
  const { teamMembers, setTeamMembers, busy, setBusy, setLog } = useAppContext();
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [newInviteRole, setNewInviteRole] = useState("member");

  async function loadTeamMembers() {
    try {
      const res = await getApi().get("/v1/partner/team/members");
      setTeamMembers(res.members || []);
    } catch (e: any) {
      console.warn("팀원 로드 실패:", e);
    }
  }

  async function inviteTeamMember() {
    if (!newInviteEmail) return;
    setBusy(true);
    setLog(`팀원 초대 중: ${newInviteEmail}`);
    try {
      await getApi().post("/v1/partner/team/invitations", { email: newInviteEmail, role: newInviteRole });
      setLog(`초대 완료: ${newInviteEmail}`);
      setNewInviteEmail("");
      await loadTeamMembers();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeTeamMember(userId: string) {
    if (!confirm("정말 추방하시겠습니까?")) return;
    setBusy(true);
    setLog(`팀원 추방 중...`);
    try {
      await getApi().delete(`/v1/partner/team/members/${userId}`);
      setLog(`팀원 추방 완료`);
      await loadTeamMembers();
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: "2px solid var(--ar-surface-muted)", paddingTop: 16, marginTop: 16 }}>
      <h3 style={{ margin: "0 0 12px 0", color: "var(--ar-ink)", fontSize: "1.1em", display: "flex", justifyContent: "space-between" }}>
        팀 멤버 관리 (EP-07-04)
        <Button onClick={loadTeamMembers} disabled={busy} style={{ background: "var(--ar-surface-muted)", border: "1px solid var(--ar-fog)", padding: "4px 8px", borderRadius: "var(--ar-r1)", cursor: "pointer", fontSize: "0.8em" }}>새로고침</Button>
      </h3>
      
      {/* 팀원 초대 폼 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, background: "var(--ar-paper-alt)", padding: 12, borderRadius: "var(--ar-r1)" }}>
        <Input 
          type="email" 
          placeholder="초대할 이메일" 
          value={newInviteEmail} 
          onChange={e => setNewInviteEmail(e.target.value)} 
          style={{ flex: 2, padding: 6 }} 
        />
        <select 
          value={newInviteRole} 
          onChange={e => setNewInviteRole(e.target.value)} 
          style={{ flex: 1, padding: 6 }}
        >
          <option value="owner">Owner (최고 관리자)</option>
          <option value="admin">Admin (관리자)</option>
          <option value="editor">Editor (편집자)</option>
          <option value="viewer">Viewer (조회자)</option>
          <option value="member">Member (일반)</option>
        </select>
        <Button onClick={inviteTeamMember} disabled={busy || !newInviteEmail} style={{ padding: "6px 12px", background: "var(--ar-ink)", color: "var(--ar-canvas)", border: "none", borderRadius: "var(--ar-r1)", cursor: "pointer", fontWeight: "bold" }}>
          초대하기
        </Button>
      </div>

      {/* 팀원 목록 */}
      {teamMembers.length === 0 ? (
        <div style={{ color: "var(--ar-slate)", fontSize: "0.85em" }}>소속된 팀원이 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {teamMembers.map(member => (
            <div key={member.userId} style={{ background: "var(--ar-canvas)", padding: 12, borderRadius: "var(--ar-r1)", border: "1px solid var(--ar-hairline)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: "bold", fontSize: "0.95em", marginBottom: 4 }}>
                  {member.email} 
                  <span style={{ marginLeft: 8, fontSize: "0.8em", padding: "2px 6px", borderRadius: "var(--ar-r2)", background: member.role === "owner" ? "var(--ar-warning-soft)" : "var(--ar-accent-soft)", color: member.role === "owner" ? "var(--ar-warning)" : "var(--ar-accent)" }}>
                    {member.role.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: "0.8em", color: "var(--ar-graphite)" }}>
                  상태: {member.status} | 합류일: {new Date(member.joinedAt).toLocaleDateString()}
                </div>
              </div>
              <Button 
                onClick={() => removeTeamMember(member.userId)} 
                disabled={busy}
                style={{ background: "var(--ar-danger-soft)", color: "var(--ar-danger)", border: "1px solid var(--ar-danger-soft)", padding: "6px 10px", borderRadius: "var(--ar-r1)", cursor: "pointer", fontSize: "0.85em" }}
              >
                추방
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
