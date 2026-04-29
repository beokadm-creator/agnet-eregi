import React from 'react';

const Ic = {
  search: () => <span>🔍</span>,
  filter: () => <span>⚙️</span>,
  plus: () => <span>+</span>,
  alert: () => <span>⚠️</span>,
  chat: () => <span>💬</span>,
  doc: () => <span>📄</span>,
};

function StatTile({ label, value, delta, hint, accent }) {
  return (
    <div className="ar-card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ar-slate)' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: accent ? 'var(--ar-accent)' : 'var(--ar-ink)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ar-graphite)', marginTop: 8 }}>{hint}</div>
    </div>
  );
}

function Column({ title, count, accent, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: accent }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
          <span style={{ fontSize: 12, color: 'var(--ar-slate)', fontWeight: 600 }}>{count}</span>
        </div>
        <button className="ar-btn ar-btn-quiet" style={{ height: 24, padding: '0 6px', fontSize: 11 }}><Ic.plus /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function CaseCard({ title, client, amount, age, tags = [], progress, flag, status, priority }) {
  return (
    <div className="ar-card" style={{ padding: 14, position: 'relative' }}>
      {priority && <span style={{ position: 'absolute', top: 10, right: 10 }} className="ar-badge ar-badge-accent ar-badge-square">긴급</span>}
      {status === 'done' && <span style={{ position: 'absolute', top: 10, right: 10 }} className="ar-badge ar-badge-success ar-badge-square">완료</span>}
      {status === 'signing' && <span style={{ position: 'absolute', top: 10, right: 10 }} className="ar-badge ar-badge-warning ar-badge-square">서명중</span>}
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ar-ink)', lineHeight: 1.4, paddingRight: priority || status ? 60 : 0 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--ar-slate)', marginTop: 4 }}>{client} · {age}</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
        {tags.map(t => <span key={t} style={{ fontSize: 11, fontWeight: 600, color: 'var(--ar-graphite)', background: 'var(--ar-paper-alt)', padding: '3px 8px', borderRadius: 6 }}>{t}</span>)}
      </div>
      {flag && (
        <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--ar-warning-soft)', borderRadius: 6, fontSize: 11, color: '#9B7A00', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ic.alert /> {flag}
        </div>
      )}
      {progress != null && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ar-slate)', marginBottom: 4 }}>
            <span>진행률</span><span style={{ fontWeight: 700, color: 'var(--ar-ink)' }}>{progress}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--ar-paper-alt)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--ar-accent)' }} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--ar-hairline)' }}>
        <div className="ar-tabular" style={{ fontSize: 13, fontWeight: 700 }}>₩{amount}</div>
        <div style={{ display: 'flex', gap: 6, color: 'var(--ar-slate)' }}>
          <Ic.chat />
          <Ic.doc />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--ar-hairline)' }}>
          <div>
            <div className="ar-eyebrow" style={{ marginBottom: 4 }}>워크보드</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>오늘 처리할 사건 12건</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input className="ar-input ar-input-sm" placeholder="사건 검색" style={{ width: 240, paddingLeft: 32 }} />
            </div>
            <button className="ar-btn ar-btn-sm ar-btn-ghost"><Ic.filter /> 필터</button>
            <button className="ar-btn ar-btn-sm ar-btn-ink"><Ic.plus /> 사건 등록</button>
          </div>
        </div>

        <div style={{ padding: '20px 32px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatTile label="신규 의뢰 (오늘)" value="3건" delta={50} hint="평균 응답 18분" />
          <StatTile label="서명 대기" value="5건" hint="고객 응답 대기 중" accent />
          <StatTile label="이번 주 매출" value="₩4.2M" delta={8} />
          <StatTile label="평균 처리 시간" value="5.4h" delta={-12} hint="목표 6시간" />
        </div>

        <div style={{ padding: 32, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, flex: 1 }}>
          <Column title="신규 의뢰" count={3} accent="var(--ar-info)">
            <CaseCard title="(주)호두컴퍼니 — 본점 이전" client="김민수" amount="33,000" age="12분 전" tags={['본점 이전']} priority />
            <CaseCard title="(주)스카이런 — 임원 변경" client="박지영" amount="29,000" age="44분 전" tags={['임원 변경']} />
            <CaseCard title="(주)오로라랩 — 자본금 증자" client="최서윤" amount="45,000" age="2시간 전" tags={['자본금 증자', '복잡']} />
          </Column>
          <Column title="서류 검토" count={4} accent="var(--ar-accent)">
            <CaseCard title="(주)데일리코드 — 법인 설립" client="이도윤" amount="49,000" age="3시간 전" tags={['법인 설립']} progress={60} />
            <CaseCard title="(주)그린포레 — 상호 변경" client="정현우" amount="29,000" age="4시간 전" tags={['상호 변경']} progress={40} flag="보완 요청 1건" />
            <CaseCard title="(주)리프트업 — 본점 이전" client="강민호" amount="33,000" age="6시간 전" tags={['본점 이전']} progress={80} />
            <CaseCard title="(주)퀀텀 — 청산" client="윤주아" amount="120,000" age="어제" tags={['청산', '복잡']} progress={30} />
          </Column>
          <Column title="서명 대기" count={3} accent="var(--ar-warning)">
            <CaseCard title="(주)노바 — 자본금 증자" client="조은지" amount="45,000" age="1일 경과" tags={['자본금 증자']} status="signing" />
            <CaseCard title="(주)아카시아 — 임원 변경" client="문지훈" amount="29,000" age="3시간 전" tags={['임원 변경']} status="signing" />
            <CaseCard title="(주)밸류체인 — 본점 이전" client="배수진" amount="33,000" age="20분 전" tags={['본점 이전']} status="signing" />
          </Column>
          <Column title="제출 · 완료" count={2} accent="var(--ar-success)">
            <CaseCard title="(주)히든랩 — 법인 설립" client="송다희" amount="49,000" age="오늘 09:12" tags={['법인 설립']} status="done" />
            <CaseCard title="(주)테이크원 — 상호 변경" client="한지원" amount="29,000" age="오늘 11:48" tags={['상호 변경']} status="done" />
          </Column>
        </div>
    </>
  );
}
