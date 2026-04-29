import React from 'react';

const Ic = {
  shield: () => <span>🛡️</span>,
  layers: () => <span>📚</span>,
  user: () => <span>👤</span>,
  card: () => <span>💳</span>,
  alert: () => <span>⚠️</span>,
  doc: () => <span>📄</span>,
  bolt: () => <span>⚡</span>,
  download: () => <span>⬇️</span>,
  arrow: () => <span>→</span>,
  chev: () => <span>›</span>,
};

function OpsNav({ active, label, icon, count, badgeColor }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
      background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
      color: active ? 'white' : '#C0C0C0',
      fontSize: 13, fontWeight: 500, cursor: 'pointer'
    }}>
      <span style={{ color: active ? 'var(--ar-accent)' : '#A0A0A0' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {count && <span style={{ fontSize: 11, color: badgeColor || '#A0A0A0', fontWeight: 600 }}>{count}</span>}
    </div>
  );
}

function SloTile({ label, value, target, status }) {
  const colors = { ok: 'var(--ar-success)', warn: 'var(--ar-warning)', err: 'var(--ar-danger)' };
  return (
    <div className="ar-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ar-slate)' }}>{label}</div>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: colors[status] }} />
      </div>
      <div className="ar-tabular" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 10, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ar-slate)', marginTop: 6 }}>{target}</div>
    </div>
  );
}

function IncRow({ id, tgt, sev, age, owner, resolved }) {
  const sevColors = { P1: 'var(--ar-danger)', P2: 'var(--ar-warning)', P3: 'var(--ar-info)' };
  return (
    <tr style={{ opacity: resolved ? 0.5 : 1 }}>
      <td className="ink ar-mono" style={{ fontSize: 12 }}>{id}</td>
      <td className="ink">{tgt}</td>
      <td>
        <span className="ar-badge ar-badge-square" style={{ background: 'var(--ar-paper-alt)', color: sevColors[sev], fontWeight: 700 }}>{sev}</span>
      </td>
      <td style={{ fontSize: 12, color: 'var(--ar-slate)' }}>{age} {resolved && '· 해결됨'}</td>
      <td>{owner === '—' ? <span style={{ color: 'var(--ar-fog)' }}>미배정</span> : owner}</td>
      <td><Ic.chev /></td>
    </tr>
  );
}

function ActionRow({ label, hint, warn }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'var(--ar-paper)', border: '1px solid var(--ar-hairline)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--ar-slate)', marginTop: 2 }}>{hint}</div>
      </div>
      <button className={`ar-btn ar-btn-sm ${warn ? 'ar-btn-soft' : 'ar-btn-ghost'}`}>실행 <Ic.arrow /></button>
    </div>
  );
}

function Audit({ who, what, tgt, when, warn, success }) {
  const dot = warn ? 'var(--ar-warning)' : success ? 'var(--ar-success)' : 'var(--ar-slate)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--ar-hairline)' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: dot }} />
      <div style={{ flex: 1, fontSize: 13, color: 'var(--ar-graphite)' }}>
        <span style={{ color: 'var(--ar-ink)', fontWeight: 700 }}>{who}</span>
        <span> · {what} · </span>
        <span className="ar-mono" style={{ color: 'var(--ar-graphite)' }}>{tgt}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ar-slate)' }}>{when}</div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="ar-root ar-paper" style={{ width: '100%', minHeight: '100dvh', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: 'var(--ar-ink)', color: '#C0C0C0', padding: '20px 12px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '6px 8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 22, height: 22 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '52% 52% 50% 50% / 60% 60% 40% 40%', background: 'var(--ar-accent)' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'white', letterSpacing: '-0.02em' }}>AgentRegi <span style={{ color: 'var(--ar-accent)' }}>Ops</span></span>
        </div>

        <div style={{ padding: '4px 8px 16px' }}>
          <input className="ar-input ar-input-sm" placeholder="검색…" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
        </div>

        <OpsNav active label="상태" icon={<Ic.shield />} />
        <OpsNav label="케이스" icon={<Ic.layers />} count="2,184" />
        <OpsNav label="파트너" icon={<Ic.user />} count="1,243" />
        <OpsNav label="정산" icon={<Ic.card />} />
        <OpsNav label="인시던트" icon={<Ic.alert />} count="2" badgeColor="var(--ar-danger)" />
        <OpsNav label="감사 로그" icon={<Ic.doc />} />

        <div style={{ marginTop: 18, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#909090', padding: '0 8px 6px', fontWeight: 700 }}>배치</div>
        <OpsNav label="일일 요약" icon={<Ic.bolt />} />
        <OpsNav label="정산 실행" icon={<Ic.bolt />} />
        <OpsNav label="구독 청구" icon={<Ic.bolt />} />

        <div style={{ marginTop: 'auto', padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: '#B0B0B0' }}>게이트</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>pilot-gate</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ar-success)' }} />
            <span style={{ color: '#B0B0B0' }}>정상 · 마지막 동기화 4분 전</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="ar-eyebrow" style={{ marginBottom: 6 }}>운영 · pilot-gate · 2026-04-28</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>플랫폼 헬스</h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ar-btn ar-btn-sm ar-btn-ghost">최근 24시간</button>
            <button className="ar-btn ar-btn-sm ar-btn-ghost"><Ic.download /> 리포트</button>
            <button className="ar-btn ar-btn-sm ar-btn-ink"><Ic.bolt /> 일일 요약 실행</button>
          </div>
        </div>

        {/* SLO row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <SloTile label="API 응답 (p95)" value="142ms" target="목표 < 200ms" status="ok" />
          <SloTile label="에러율" value="0.18%" target="목표 < 0.5%" status="ok" />
          <SloTile label="등기 SLA 준수율" value="98.7%" target="목표 ≥ 95%" status="ok" />
          <SloTile label="Webhook 재시도율" value="2.4%" target="임계 3%" status="warn" />
        </div>

        {/* Two-column */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, flex: 1 }}>
          {/* Left — incidents + queue */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ar-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ar-hairline)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>활성 인시던트</h3>
                  <span className="ar-badge ar-badge-danger">2</span>
                </div>
                <button className="ar-btn ar-btn-sm ar-btn-quiet">전체 보기 <Ic.arrow /></button>
              </div>
              <table className="ar-table">
                <thead>
                  <tr><th>ID</th><th>대상</th><th>심각도</th><th>발생</th><th>담당</th><th></th></tr>
                </thead>
                <tbody>
                  <IncRow id="INC-2891" tgt="b2g.court.kr · 5xx 누적" sev="P2" age="34분" owner="박지훈" />
                  <IncRow id="INC-2890" tgt="Stripe webhook 재시도 임계" sev="P3" age="2시간" owner="—" />
                  <IncRow id="INC-2887" tgt="OCR 큐 백로그 (해결됨)" sev="P2" age="어제" owner="김재연" resolved />
                  <IncRow id="INC-2886" tgt="Kakao 알림톡 지연 (해결됨)" sev="P3" age="어제" owner="정민수" resolved />
                </tbody>
              </table>
            </div>
          </div>

          {/* Right — quick actions + audit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ar-card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>빠른 실행</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                <ActionRow label="일일 Gate 요약" hint="모든 게이트 기준" />
                <ActionRow label="패키지 재생성" hint="case_id 필요" />
                <ActionRow label="정산 배치 실행" hint="period_end = 오늘" warn />
                <ActionRow label="구독 결제 배치" hint="targetDate = 오늘" />
                <ActionRow label="권한 부여 (RBAC)" hint="ops_operator+" />
              </div>
            </div>

            <div className="ar-card" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ar-hairline)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>최근 감사 로그</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Audit who="박지훈" what="패키지 재생성" tgt="case_a8f3c2" when="2분 전" />
                <Audit who="시스템" what="정산 배치 시작" tgt="period 2026-04-27" when="14분 전" />
                <Audit who="김재연" what="RBAC 부여" tgt="user_4b9c · ops_viewer" when="1시간 전" />
                <Audit who="시스템" what="Webhook 재시도 (3/5)" tgt="evt_kak_91x" when="2시간 전" warn />
                <Audit who="정민수" what="인시던트 해결" tgt="INC-2886" when="어제" success />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
