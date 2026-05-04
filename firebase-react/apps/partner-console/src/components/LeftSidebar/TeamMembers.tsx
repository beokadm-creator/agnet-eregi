import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { getApi } from "../../services/api";

export default function TeamMembers() {
  const { teamMembers, setTeamMembers, busy, setBusy, setLog } = useAppContext();
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [newInviteRole, setNewInviteRole] = useState("viewer");

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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, color: "var(--pc-text)", fontSize: 14, fontWeight: 600 }}>팀 멤버 목록</h3>
        <button onClick={loadTeamMembers} disabled={busy} className="pc-btn">새로고침</button>
      </div>
      
      {/* 팀원 초대 폼 */}
      <div style={{ display: "flex", gap: 8, background: "var(--pc-surface)", padding: 16, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)" }}>
        <input 
          type="email" 
          placeholder="초대할 이메일" 
          value={newInviteEmail} 
          onChange={e => setNewInviteEmail(e.target.value)} 
          className="pc-input"
          style={{ flex: 2 }} 
        />
        <select 
          value={newInviteRole} 
          onChange={e => setNewInviteRole(e.target.value)} 
          className="pc-input"
          style={{ flex: 1 }}
        >
          <option value="owner">최고 관리자</option>
          <option value="admin">관리자</option>
          <option value="editor">편집자</option>
          <option value="viewer">조회자</option>
        </select>
        <button onClick={inviteTeamMember} disabled={busy || !newInviteEmail} className="pc-btn pc-btn-brand">
          초대하기
        </button>
      </div>

      {/* 팀원 목록 */}
      {teamMembers.length === 0 ? (
        <div style={{ color: "var(--pc-text-muted)", fontSize: 13, background: "var(--pc-surface)", padding: 16, borderRadius: "var(--pc-radius)", textAlign: "center" }}>소속된 팀원이 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {teamMembers?.map(member => (
            <div key={member.userId} style={{ background: "var(--pc-surface)", padding: 16, borderRadius: "var(--pc-radius)", border: "1px solid var(--pc-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  {member.email} 
                  <span className={`pc-badge ${member.role === "owner" ? "pc-badge-warning" : "pc-badge-brand"}`}>
                    {member.role.toUpperCase()}
                  </span>
                </div>
                <div className="pc-mono" style={{ fontSize: 12, color: "var(--pc-text-muted)" }}>
                  상태: {member.status} | 합류일: {new Date(member.joinedAt).toLocaleDateString()}
                </div>
              </div>
              <button 
                onClick={() => removeTeamMember(member.userId)} 
                disabled={busy}
                className="pc-btn pc-btn-danger"
              >
                추방
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
