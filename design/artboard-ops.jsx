/* eslint-disable */

function OpsArtboard() {
  return (
    <div className="ar-root ar-paper" style={{ width: 1440, minHeight: 980, display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: 'var(--ar-ink)', color: 'oklch(80% 0 0)', padding: '20px 12px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '6px 8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 22, height: 22 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '52% 52% 50% 50% / 60% 60% 40% 40%', background: 'var(--ar-accent)' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'white', letterSpacing: '-0.02em' }}>AgentRegi <span style={{ color: 'var(--ar-accent)' }}>Ops</span></span>
        </div>

        <div style={{ padding: '4px 8px 16px' }}>
          <input className="ar-input ar-input-sm" placeholder="search…" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
        </div>

        <OpsNav active label="Health" icon={<window.Ic.shield />} />
        <OpsNav label="Cases" icon={<window.Ic.layers />} count="2,184" />
        <OpsNav label="Partners" icon={<window.Ic.user />} count="1,243" />
        <OpsNav label="Settlements" icon={<window.Ic.card />} />
        <OpsNav label="Incidents" icon={<window.Ic.alert />} count="2" badgeColor="var(--ar-danger)" />
        <OpsNav label="Audit Log" icon={<window.Ic.doc />} />

        <div style={{ marginTop: 18, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'oklch(55% 0 0)', padding: '0 8px 6px', fontWeight: 700 }}>Batches</div>
        <OpsNav label="Daily summary" icon={<window.Ic.bolt />} />
        <OpsNav label="Settlement run" icon={<window.Ic.bolt />} />
        <OpsNav label="Subscription bill" icon={<window.Ic.bolt />} />

        <div style={{ marginTop: 'auto', padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: 'oklch(70% 0 0)' }}>Gate</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>pilot-gate</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ar-success)' }} />
            <span style={{ color: 'oklch(70% 0 0)' }}>healthy · last sync 4m</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="ar-eyebrow" style={{ marginBottom: 6 }}>Operations · pilot-gate · 2026-04-28</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>플랫폼 헬스</h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ar-btn ar-btn-sm ar-btn-ghost">last 24h</button>
            <button className="ar-btn ar-btn-sm ar-btn-ghost"><window.Ic.download /> 리포트</button>
            <button className="ar-btn ar-btn-sm ar-btn-ink"><window.Ic.bolt /> 일일 요약 실행</button>
          </div>
        </div>

        {/* SLO row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <SloTile label="API 응답 (p95)" value="142ms" target="목표 < 200ms" status="ok" series={[140,138,150,142,138,144,142,139,141,143,142,140]} />
          <SloTile label="에러율" value="0.18%" target="목표 < 0.5%" status="ok" series={[0.2,0.15,0.18,0.22,0.19,0.16,0.18,0.21,0.19,0.18,0.17,0.18]} />
          <SloTile label="등기 SLA 준수율" value="98.7%" target="목표 ≥ 95%" status="ok" series={[97,98,99,98,97,98,99,98,99,98,98,99]} />
          <SloTile label="Webhook 재시도율" value="2.4%" target="임계 3%" status="warn" series={[1.8,2.0,2.1,2.4,2.5,2.4,2.6,2.4,2.3,2.5,2.4,2.4]} />
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
                <button className="ar-btn ar-btn-sm ar-btn-quiet">전체 보기 <window.Ic.arrow /></button>
              </div>
              <table className="ar-table">
                <thead>
                  <tr><th>ID</th><th>대상</th><th>심각도</th><th>발생</th><th>담당</th><th></th></tr>
                </thead>
                <tbody>
                  <IncRow id="INC-2891" tgt="b2g.court.kr · 5xx 누적" sev="P2" age="34분" owner="박지훈" />
                  <IncRow id="INC-2890" tgt="Stripe webhook 재시도 임계" sev="P3" age="2시간" owner="—" />
                  <IncRow id="INC-2887" tgt="OCR 큐 백로그 (resolved)" sev="P2" age="어제" owner="김재연" resolved />
                  <IncRow id="INC-2886" tgt="Kakao 알림톡 지연 (resolved)" sev="P3" age="어제" owner="정민수" resolved />
                </tbody>
              </table>
            </div>

            <div className="ar-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ar-hairline)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>케이스 처리 추이</h3>
                <div style={{ fontSize: 12, color: 'var(--ar-slate)', marginTop: 4 }}>최근 12시간 · 시간당 처리량</div>
              </div>
              <div style={{ padding: 24 }}>
                <window.Bars data={[18, 22, 26, 31, 28, 35, 42, 38, 44, 51, 47, 52]} height={140} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--ar-slate)' }}>
                  <span>04시</span><span>10시</span><span>16시</span>
                </div>
              </div>
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

function OpsNav({ active, label, icon, count, badgeColor }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
      background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
      color: active ? 'white' : 'oklch(78% 0 0)',
      fontSize: 13, fontWeight: 500, cursor: 'pointer'
    }}>
      <span style={{ color: active ? 'var(--ar-accent)' : 'oklch(60% 0 0)' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {count && <span style={{ fontSize: 11, color: badgeColor || 'oklch(60% 0 0)', fontWeight: 600 }}>{count}</span>}
    </div>
  );
}

function SloTile({ label, value, target, status, series }) {
  const colors = { ok: 'var(--ar-success)', warn: 'var(--ar-warning)', err: 'var(--ar-danger)' };
  return (
    <div className="ar-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ar-slate)' }}>{label}</div>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: colors[status] }} />
      </div>
      <div className="ar-tabular" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 10, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ar-slate)', marginTop: 6 }}>{target}</div>
      <div style={{ marginTop: 12 }}>
        <window.Spark data={series} color={colors[status]} width={180} height={28} />
      </div>
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
      <td style={{ fontSize: 12, color: 'var(--ar-slate)' }}>{age} {resolved && '· resolved'}</td>
      <td>{owner === '—' ? <span style={{ color: 'var(--ar-fog)' }}>미배정</span> : owner}</td>
      <td><window.Ic.chev style={{ color: 'var(--ar-slate)' }} /></td>
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
      <button className={`ar-btn ar-btn-sm ${warn ? 'ar-btn-soft' : 'ar-btn-ghost'}`}>실행 <window.Ic.arrow /></button>
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

window.OpsArtboard = OpsArtboard;
