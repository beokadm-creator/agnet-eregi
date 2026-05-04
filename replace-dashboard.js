const fs = require('fs');
const path = require('path');

const userWebDashboard = `import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../apiBase';

const ARLogo = ({ size = 24 }) => (
  <div style={{ width: size, height: size, background: 'var(--ar-accent)', borderRadius: '50%', display: 'inline-block' }} />
);

const Ic = {
  search: () => <span>🔍</span>,
  arrow: () => <span>→</span>,
  pin: () => <span>📍</span>,
  star: () => <span>⭐</span>,
};

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
          <Ic.pin /> {area} · ★ {rating} · 후기 {count}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 }}>
          <div className="ar-tabular" style={{ fontSize: 20, fontWeight: 800 }}>{price}<span style={{ fontSize: 12, color: 'var(--ar-slate)' }}>원~</span></div>
          <span className="ar-badge ar-badge-success">예약 가능</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="ar-root ar-paper" style={{ width: '100%', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 56px', borderBottom: '1px solid var(--ar-hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <ARLogo size={26} />
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
              <Ic.search />
              <input style={{ flex: 1, height: 56, border: 'none', outline: 'none', fontSize: 17, fontWeight: 500, background: 'transparent', color: 'var(--ar-ink)' }} placeholder="어떤 등기가 필요하세요? 예) 본점 이전" />
            </div>
            <button className="ar-btn ar-btn-lg ar-btn-accent" style={{ height: 56, padding: '0 24px' }}>찾아보기 <Ic.arrow /></button>
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
            tagColor="#E0B0FF"
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
            tagColor="#90EE90"
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
            <div style={{ fontSize: 13, color: '#A0A0A0', marginTop: 4 }}>{x.t}</div>
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
          <button className="ar-btn ar-btn-ghost">자세히 보기 <Ic.arrow /></button>
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
              <div style={{ fontSize: 14, lineHeight: 1.6, color: i === 0 ? '#C0C0C0' : 'var(--ar-graphite)' }}>{s.d}</div>
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
                  <Ic.pin /> {o.a}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, fontSize: 13, color: 'var(--ar-graphite)' }}>
                  <Ic.star style={{ color: 'var(--ar-accent)' }} />
                  <span style={{ color: 'var(--ar-ink)', fontWeight: 700 }}>{o.r}</span>
                  <span>· 후기 {o.c}건</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--ar-hairline)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ar-slate)', fontWeight: 600 }}>최저</div>
                    <div className="ar-tabular" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{o.p}<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ar-slate)' }}>원~</span></div>
                  </div>
                  <button className="ar-btn ar-btn-sm ar-btn-soft">의뢰 <Ic.arrow /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`;

const partnerDashboard = `import React from 'react';

const ARLogo = ({ size = 24 }) => (
  <div style={{ width: size, height: size, background: 'var(--ar-accent)', borderRadius: '50%', display: 'inline-block' }} />
);

const Avatar = ({ name, size = 32 }) => (
  <div style={{ width: size, height: size, background: 'var(--ar-accent-soft)', color: 'var(--ar-accent-ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
    {name}
  </div>
);

const Ic = {
  chev: () => <span>›</span>,
  layers: () => <span>📚</span>,
  inbox: () => <span>📥</span>,
  doc: () => <span>📄</span>,
  bolt: () => <span>⚡</span>,
  user: () => <span>👤</span>,
  shield: () => <span>🛡️</span>,
  card: () => <span>💳</span>,
  bell: () => <span>🔔</span>,
  search: () => <span>🔍</span>,
  filter: () => <span>⚙️</span>,
  plus: () => <span>+</span>,
  alert: () => <span>⚠️</span>,
  chat: () => <span>💬</span>,
};

function NavItem({ active, icon, label, badge, badgeAccent }) {
  return (
    <div className={\`ar-nav-item \${active ? 'active' : ''}\`}>
      <span style={{ color: active ? 'white' : 'var(--ar-slate)' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
          background: badgeAccent ? 'var(--ar-accent)' : (active ? 'rgba(255,255,255,0.18)' : 'var(--ar-paper-alt)'),
          color: badgeAccent ? 'white' : (active ? 'white' : 'var(--ar-graphite)')
        }}>{badge}</span>
      )}
    </div>
  );
}

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
            <div style={{ width: \`\${progress}%\`, height: '100%', background: 'var(--ar-accent)' }} />
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
    <div className="ar-root ar-paper" style={{ width: '100%', minHeight: '100dvh', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{ width: 240, background: 'var(--ar-canvas)', borderRight: '1px solid var(--ar-hairline)', padding: '20px 14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '6px 8px 16px' }}>
          <ARLogo size={22} />
        </div>
        <div className="ar-card" style={{ padding: 12, margin: '4px 0 12px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--ar-paper-alt)', border: 'none' }}>
          <Avatar name="해" size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>해담 법무사</div>
            <div style={{ fontSize: 11, color: 'var(--ar-slate)' }}>강남 사무소 · 김재원</div>
          </div>
          <Ic.chev />
        </div>

        <div className="ar-nav-section">메인</div>
        <NavItem active icon={<Ic.layers />} label="케이스 워크보드" badge="12" />
        <NavItem icon={<Ic.inbox />} label="신규 의뢰" badge="3" badgeAccent />
        <NavItem icon={<Ic.doc />} label="서류함" />
        <NavItem icon={<Ic.bolt />} label="견적 · 청구" />

        <div className="ar-nav-section">설정</div>
        <NavItem icon={<Ic.user />} label="팀원" />
        <NavItem icon={<Ic.shield />} label="템플릿" />
        <NavItem icon={<Ic.card />} label="정산" />
        <NavItem icon={<Ic.bell />} label="알림 설정" />

        <div style={{ marginTop: 'auto', padding: 12, background: 'var(--ar-accent-soft)', borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ar-accent-ink)' }}>이번 주 SLA 98%</div>
          <div style={{ fontSize: 11, color: 'var(--ar-accent-ink)', opacity: 0.8, marginTop: 4 }}>품질 등급 유지 중</div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
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

        {/* Stat row */}
        <div style={{ padding: '20px 32px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatTile label="신규 의뢰 (오늘)" value="3건" delta={50} hint="평균 응답 18분" />
          <StatTile label="서명 대기" value="5건" hint="고객 응답 대기 중" accent />
          <StatTile label="이번 주 매출" value="₩4.2M" delta={8} />
          <StatTile label="평균 처리 시간" value="5.4h" delta={-12} hint="목표 6시간" />
        </div>

        {/* Workboard */}
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
      </main>
    </div>
  );
}
`;

const opsDashboard = `import React from 'react';

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
      <td style={{ fontSize: 12, color: 'var(--ar-slate)' }}>{age} {resolved && '· resolved'}</td>
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
      <button className={\`ar-btn ar-btn-sm \${warn ? 'ar-btn-soft' : 'ar-btn-ghost'}\`}>실행 <Ic.arrow /></button>
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
          <input className="ar-input ar-input-sm" placeholder="search…" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
        </div>

        <OpsNav active label="Health" icon={<Ic.shield />} />
        <OpsNav label="Cases" icon={<Ic.layers />} count="2,184" />
        <OpsNav label="Partners" icon={<Ic.user />} count="1,243" />
        <OpsNav label="Settlements" icon={<Ic.card />} />
        <OpsNav label="Incidents" icon={<Ic.alert />} count="2" badgeColor="var(--ar-danger)" />
        <OpsNav label="Audit Log" icon={<Ic.doc />} />

        <div style={{ marginTop: 18, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#909090', padding: '0 8px 6px', fontWeight: 700 }}>Batches</div>
        <OpsNav label="Daily summary" icon={<Ic.bolt />} />
        <OpsNav label="Settlement run" icon={<Ic.bolt />} />
        <OpsNav label="Subscription bill" icon={<Ic.bolt />} />

        <div style={{ marginTop: 'auto', padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: '#B0B0B0' }}>Gate</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>pilot-gate</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ar-success)' }} />
            <span style={{ color: '#B0B0B0' }}>healthy · last sync 4m</span>
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
                  <IncRow id="INC-2887" tgt="OCR 큐 백로그 (resolved)" sev="P2" age="어제" owner="김재연" resolved />
                  <IncRow id="INC-2886" tgt="Kakao 알림톡 지연 (resolved)" sev="P3" age="어제" owner="정민수" resolved />
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
`;

fs.writeFileSync(path.join(__dirname, 'firebase-react/apps/user-web/src/pages/Dashboard.tsx'), userWebDashboard);
fs.writeFileSync(path.join(__dirname, 'firebase-react/apps/partner-console/src/pages/Dashboard.tsx'), partnerDashboard);
fs.writeFileSync(path.join(__dirname, 'firebase-react/apps/ops-console/src/pages/Dashboard.tsx'), opsDashboard);

console.log("Replaced Dashboard files in all 3 apps");
