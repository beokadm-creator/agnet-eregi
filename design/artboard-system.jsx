/* eslint-disable */

function SystemArtboard() {
  const swatches = [
    { n: 'Paper', v: '#FAF8F4' },
    { n: 'Paper Alt', v: '#F4F1EA' },
    { n: 'Canvas', v: '#FFFFFF' },
    { n: 'Hairline', v: '#E9E5DC' },
    { n: 'Slate', v: '#76767E' },
    { n: 'Graphite', v: '#46474C' },
    { n: 'Ink', v: '#0A0A0A' },
  ];
  const accents = [
    { n: 'Cognac', v: '#D87242' },
    { n: 'Cognac Soft', v: '#FDEDE2' },
    { n: 'Success', v: '#1F9D55' },
    { n: 'Warning', v: '#E0A019' },
    { n: 'Danger', v: '#D1372B' },
    { n: 'Info', v: '#2F6FE0' },
  ];

  return (
    <div className="ar-root ar-paper" style={{ width: 1280, padding: 56, display: 'grid', gap: 56 }}>
      {/* Hero */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--ar-hairline)', paddingBottom: 36 }}>
        <div style={{ maxWidth: 720 }}>
          <div className="ar-eyebrow" style={{ marginBottom: 16 }}>Hodu Design System · v1.0</div>
          <h1 style={{ fontSize: 76, fontWeight: 800, lineHeight: 1, margin: 0, letterSpacing: '-0.035em', color: 'var(--ar-ink)' }}>
            등기를 가장 쉽게.<br/>
            <span style={{ color: 'var(--ar-accent)' }}>AgentRegi</span> 디자인 시스템.
          </h1>
          <p style={{ marginTop: 22, fontSize: 17, color: 'var(--ar-graphite)', lineHeight: 1.6 }}>
            법무사 사무소를 직방처럼 둘러보고, 등기를 토스처럼 쉽게.
            User · Partner · Ops 세 콘솔이 동일한 토큰·셸·언어를 공유합니다.
          </p>
        </div>
        <window.ARLogo size={36} />
      </div>

      {/* Type */}
      <Section eyebrow="Typography" caption="Pretendard 한 패밀리. weight ladder로 위계 표현. 세리프·여러 폰트 조합 ❌">
        <div style={{ display: 'grid', gap: 16 }}>
          <Row label="Display 64 / 800" size={64} weight={800}>법인 등기, 5분이면 시작</Row>
          <Row label="Title 32 / 700" size={32} weight={700}>케이스 워크보드</Row>
          <Row label="Heading 22 / 700" size={22} weight={700}>이번 주 처리해야 할 사건</Row>
          <Row label="Body 15 / 500" size={15} weight={500}>본문은 항상 Pretendard 500. 한·영·숫자 균형이 좋고 가독성이 높습니다.</Row>
          <Row label="Meta 13 / 500" size={13} weight={500} color="var(--ar-slate)">2025-04-28 · 신청 후 4시간 경과 · 평균 처리 6시간</Row>
          <Row label="Mono 12 / 500" size={12} weight={500} color="var(--ar-graphite)" mono>case_a8f3c2 · refund_id_7e1b · TX 0x3a…f9c</Row>
        </div>
      </Section>

      <div className="ar-divider" />

      {/* Color */}
      <Section eyebrow="Color" caption="따뜻한 페이퍼 + 잉크. 액센트 코냑색은 행동 유도와 브랜드 톤에만.">
        <div style={{ display: 'grid', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
            {swatches.map(s => (
              <div key={s.n}>
                <div style={{ height: 96, background: s.v, border: '1px solid var(--ar-hairline)', borderRadius: 12 }} />
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>{s.n}</div>
                <div className="ar-mono" style={{ fontSize: 11, color: 'var(--ar-slate)', marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
            {accents.map(s => (
              <div key={s.n}>
                <div style={{ height: 64, background: s.v, borderRadius: 12, border: '1px solid var(--ar-hairline)' }} />
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>{s.n}</div>
                <div className="ar-mono" style={{ fontSize: 11, color: 'var(--ar-slate)', marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <div className="ar-divider" />

      {/* Components */}
      <Section eyebrow="Components" caption="44px 기본 높이, 12px 라운드. 한 화면에 단 하나의 primary CTA.">
        <div style={{ display: 'grid', gap: 28 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="ar-btn ar-btn-xl ar-btn-accent">법인 등기 시작하기 <window.Ic.arrow /></button>
            <button className="ar-btn ar-btn-lg ar-btn-ink">서명 후 제출</button>
            <button className="ar-btn ar-btn-ghost">미리보기</button>
            <button className="ar-btn ar-btn-soft">파일 첨부</button>
            <button className="ar-btn ar-btn-quiet">취소</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div className="ar-label" style={{ marginBottom: 8 }}>법인명</div>
              <input className="ar-input" defaultValue="(주)호두컴퍼니" />
            </div>
            <div>
              <div className="ar-label" style={{ marginBottom: 8 }}>의뢰 유형</div>
              <input className="ar-input" placeholder="예) 본점 이전 등기" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="ar-badge ar-badge-neutral"><span className="ar-badge-dot" style={{ background: 'var(--ar-slate)' }}/> 작성 중</span>
            <span className="ar-badge ar-badge-info"><span className="ar-badge-dot" style={{ background: 'var(--ar-info)' }}/> 검토 중</span>
            <span className="ar-badge ar-badge-accent"><span className="ar-badge-dot" style={{ background: 'var(--ar-accent)' }}/> 서명 대기</span>
            <span className="ar-badge ar-badge-success"><span className="ar-badge-dot" style={{ background: 'var(--ar-success)' }}/> 등기 완료</span>
            <span className="ar-badge ar-badge-warning"><span className="ar-badge-dot" style={{ background: 'var(--ar-warning)' }}/> 보완 필요</span>
            <span className="ar-badge ar-badge-danger"><span className="ar-badge-dot" style={{ background: 'var(--ar-danger)' }}/> 반려</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="ar-chip selected">법인 설립</button>
            <button className="ar-chip">본점 이전</button>
            <button className="ar-chip">임원 변경</button>
            <button className="ar-chip">자본금 증자</button>
            <button className="ar-chip">상호 변경</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <window.StatTile label="처리 중인 의뢰" value="48건" delta={12} hint="평균 6.2시간" />
            <window.StatTile label="이번 달 매출" value="₩12.4M" delta={-3} hint="전월 대비" accent />
            <window.StatTile label="SLA 준수율" value="98.7%" delta={1} hint="목표 95%" />
          </div>
        </div>
      </Section>

      <div className="ar-divider" />

      {/* Surfaces */}
      <Section eyebrow="Three surfaces, one family" caption="동일한 토큰·셸. 차이는 정보 밀도와 액센트 사용량뿐.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { n: 'User Web', s: 'B2C · 의뢰 → 결제 → 추적', d: '큰 폰트, 여백, 액센트 적극 사용. 모바일 친화.', tone: 'var(--ar-accent)', icon: <window.Ic.user /> },
            { n: 'Partner Console', s: 'B2B · 케이스 워크보드', d: '3단 워크보드. 액센트는 status·CTA만.', tone: 'var(--ar-ink)', icon: <window.Ic.layers /> },
            { n: 'Ops Console', s: '내부 · 모니터링/배치/정산', d: '대시보드 + 표 중심. 데이터 가독성 우선.', tone: 'var(--ar-graphite)', icon: <window.Ic.shield /> },
          ].map(s => (
            <div key={s.n} className="ar-card" style={{ padding: 24 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ar-paper-alt)', display: 'grid', placeItems: 'center', color: s.tone, marginBottom: 16 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{s.n}</div>
              <div className="ar-mono" style={{ fontSize: 11, color: 'var(--ar-slate)', marginTop: 6 }}>{s.s}</div>
              <div style={{ fontSize: 14, color: 'var(--ar-graphite)', marginTop: 14, lineHeight: 1.6 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ eyebrow, caption, children }) {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 40 }}>
      <div>
        <div className="ar-eyebrow" style={{ color: 'var(--ar-accent-ink)' }}>{eyebrow}</div>
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ar-slate)', lineHeight: 1.6 }}>{caption}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Row({ label, size, weight, color, mono, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'baseline', borderBottom: '1px solid var(--ar-hairline)', paddingBottom: 14 }}>
      <div className="ar-mono" style={{ fontSize: 11, color: 'var(--ar-slate)' }}>{label}</div>
      <div className={mono ? 'ar-mono' : ''} style={{ fontSize: size, fontWeight: weight, color: color || 'var(--ar-ink)', lineHeight: 1.2, letterSpacing: size > 28 ? '-0.025em' : '-0.005em' }}>{children}</div>
    </div>
  );
}

window.SystemArtboard = SystemArtboard;
