/* eslint-disable */
const { useState: useStateUW } = React;

function UserWebArtboard() {
  return (
    <div className="ar-root ar-paper" style={{ width: 1280, minHeight: 1620, display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 56px', borderBottom: '1px solid var(--ar-hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <window.ARLogo size={26} />
          <nav style={{ display: 'flex', gap: 24, fontSize: 14, fontWeight: 600, color: 'var(--ar-graphite)' }}>
            <span style={{ color: 'var(--ar-ink)' }}>법인 등기</span>
            <span>부동산 등기</span>
            <span>법무사 찾기</span>
            <span>가격 안내</span>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="ar-btn ar-btn-quiet ar-btn-sm">로그인</button>
          <button className="ar-btn ar-btn-sm ar-btn-ink">시작하기</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '72px 56px 56px', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 56, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'var(--ar-accent-soft)', color: 'var(--ar-accent-ink)', fontSize: 13, fontWeight: 700, marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ar-accent)' }} />
            전국 1,200곳의 법무사가 입점
          </div>
          <h1 style={{ fontSize: 84, fontWeight: 800, lineHeight: 0.98, margin: 0, letterSpacing: '-0.04em' }}>
            법인 등기,<br/>
            <span style={{ color: 'var(--ar-accent)' }}>5분</span>이면 시작.
          </h1>
          <p style={{ marginTop: 28, fontSize: 19, color: 'var(--ar-graphite)', lineHeight: 1.55, maxWidth: 520 }}>
            동네 법무사 사무소를 한눈에 비교하고, 카톡으로 서류받고, 등기까지 비대면으로. 평균 처리 6시간.
          </p>
          {/* Big search */}
          <div className="ar-card-soft" style={{ marginTop: 36, padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
              <window.Ic.search style={{ color: 'var(--ar-slate)' }} />
              <input style={{ flex: 1, height: 56, border: 'none', outline: 'none', fontSize: 17, fontWeight: 500, background: 'transparent' }} placeholder="어떤 등기가 필요하세요? 예) 본점 이전" />
            </div>
            <button className="ar-btn ar-btn-lg ar-btn-accent" style={{ height: 56, padding: '0 24px' }}>찾아보기 <window.Ic.arrow /></button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {['법인 설립', '본점 이전', '임원 변경', '자본금 증자', '상호 변경', '청산'].map(t => (
              <button key={t} className="ar-btn ar-btn-sm ar-btn-ghost" style={{ background: 'var(--ar-canvas)' }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Right — featured law office card stack */}
        <div style={{ position: 'relative', height: 520 }}>
          <FeaturedOfficeCard
            style={{ position: 'absolute', top: 40, left: 40, width: 340, transform: 'rotate(-3deg)' }}
            office="해담 법무사"
            area="서울 강남"
            rating={4.9}
            count={428}
            price="33,000"
            eta="4시간"
            tagColor="oklch(85% 0.06 250)"
          />
          <FeaturedOfficeCard
            style={{ position: 'absolute', top: 0, right: 0, width: 360, transform: 'rotate(2deg)' }}
            office="이로운 법무법인"
            area="서울 마포"
            rating={4.8}
            count={892}
            price="29,000"
            eta="3시간"
            featured
            tagColor="var(--ar-accent-soft)"
          />
          <FeaturedOfficeCard
            style={{ position: 'absolute', bottom: 0, left: 0, width: 320, transform: 'rotate(-1deg)' }}
            office="청람 법무사"
            area="경기 성남"
            rating={4.9}
            count={314}
            price="35,000"
            eta="5시간"
            tagColor="oklch(86% 0.05 150)"
          />
        </div>
      </div>

      {/* Section: trust bar */}
      <div style={{ background: 'var(--ar-ink)', color: 'white', padding: '36px 56px', display: 'flex', justifyContent: 'space-between', gap: 56 }}>
        {[
          { n: '12,400+', t: '누적 등기 처리' },
          { n: '평균 6시간', t: '신청 → 완료' },
          { n: '4.9 / 5.0', t: '실 사용자 평점' },
          { n: '1,200+', t: '입점 법무사 사무소' },
        ].map(x => (
          <div key={x.n}>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em' }}>{x.n}</div>
            <div style={{ fontSize: 13, color: 'oklch(75% 0 0)', marginTop: 4 }}>{x.t}</div>
          </div>
        ))}
      </div>

      {/* Section: how it works */}
      <div style={{ padding: '72px 56px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36 }}>
          <div>
            <div className="ar-eyebrow" style={{ color: 'var(--ar-accent-ink)', marginBottom: 10 }}>How it works</div>
            <h2 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.025em', margin: 0 }}>비대면으로, 4단계면 끝.</h2>
          </div>
          <button className="ar-btn ar-btn-ghost">자세히 보기 <window.Ic.arrow /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { n: '01', t: '필요한 등기 선택', d: '5개 질문에 답하면 어떤 서류가 필요한지 알려드려요.' },
            { n: '02', t: '법무사 비교 · 선택', d: '가까운 사무소를 평점·가격·처리시간으로 비교.' },
            { n: '03', t: '카톡으로 서류 제출', d: '사진만 찍어서 보내면 AI가 검토해드려요.' },
            { n: '04', t: '등기부 도착', d: '평균 6시간. 등기 완료되면 PDF로 받아보세요.' },
          ].map((s, i) => (
            <div key={s.n} className="ar-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, background: i === 0 ? 'var(--ar-ink)' : 'var(--ar-canvas)', color: i === 0 ? 'white' : 'var(--ar-ink)', borderColor: i === 0 ? 'var(--ar-ink)' : 'var(--ar-hairline)' }}>
              <div className="ar-mono" style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? 'var(--ar-accent)' : 'var(--ar-accent)' }}>{s.n}</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.015em' }}>{s.t}</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: i === 0 ? 'oklch(80% 0 0)' : 'var(--ar-graphite)' }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section: featured law offices */}
      <div style={{ padding: '36px 56px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.025em', margin: 0 }}>이번 주 인기 법무사</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ar-btn ar-btn-sm ar-btn-ink">서울</button>
            <button className="ar-btn ar-btn-sm ar-btn-ghost">경기</button>
            <button className="ar-btn ar-btn-sm ar-btn-ghost">전국</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { n: '이로운 법무법인', a: '서울 마포', r: 4.9, c: 892, p: '29,000', e: '3시간', t: '법인 설립 1위' },
            { n: '해담 법무사', a: '서울 강남', r: 4.9, c: 428, p: '33,000', e: '4시간', t: '본점 이전 빠름' },
            { n: '청람 법무사', a: '경기 성남', r: 4.8, c: 314, p: '35,000', e: '5시간', t: '신생 강자' },
          ].map(o => (
            <div key={o.n} className="ar-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="ar-photo" style={{ height: 140, borderRadius: 0 }}>사무소 사진</div>
              <div style={{ padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div style={{ fontSize: 19, fontWeight: 700 }}>{o.n}</div>
                  <span className="ar-badge ar-badge-accent">{o.t}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ar-slate)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <window.Ic.pin /> {o.a}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, fontSize: 13, color: 'var(--ar-graphite)' }}>
                  <window.Ic.star style={{ color: 'var(--ar-accent)' }} />
                  <span style={{ color: 'var(--ar-ink)', fontWeight: 700 }}>{o.r}</span>
                  <span>· 후기 {o.c}건</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--ar-hairline)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ar-slate)', fontWeight: 600 }}>최저</div>
                    <div className="ar-tabular" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{o.p}<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ar-slate)' }}>원~</span></div>
                  </div>
                  <button className="ar-btn ar-btn-sm ar-btn-soft">의뢰 <window.Ic.arrow /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeaturedOfficeCard({ style, office, area, rating, count, price, eta, featured, tagColor }) {
  return (
    <div className="ar-card-soft" style={{ ...style, padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 140, background: tagColor, position: 'relative' }}>
        {featured && (
          <div style={{ position: 'absolute', top: 14, left: 14, background: 'var(--ar-accent)', color: 'white', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>
            ★ 이번 주 인기
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(10,10,10,0.7)', color: 'white', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999 }}>
          평균 {eta}
        </div>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{office}</div>
        <div style={{ fontSize: 12, color: 'var(--ar-slate)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <window.Ic.pin /> {area} · ★ {rating} · 후기 {count}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 }}>
          <div className="ar-tabular" style={{ fontSize: 20, fontWeight: 800 }}>{price}<span style={{ fontSize: 12, color: 'var(--ar-slate)' }}>원~</span></div>
          <span className="ar-badge ar-badge-success">예약 가능</span>
        </div>
      </div>
    </div>
  );
}

window.UserWebArtboard = UserWebArtboard;
