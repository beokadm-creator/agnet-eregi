import React from 'react';
import { useNavigate } from 'react-router-dom';

const Ic = {
  search: () => <span>🔍</span>,
  arrow: () => <span style={{ fontSize: '18px' }}>→</span>,
  pin: () => <span>📍</span>,
  star: () => <span>⭐</span>,
  check: () => <span>✓</span>,
};

function FeaturedOfficeCard({ style, office, area, rating, count, price, eta, featured, tagColor }: any) {
  return (
    <div className="uw-featured-card" style={{ ...style }}>
      <div style={{ height: 140, background: tagColor, borderRadius: '12px', position: 'relative', overflow: 'hidden' }}>
        {featured && (
          <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.9)', color: 'var(--uw-brand)', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            ★ 이번 주 인기
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, backdropFilter: 'blur(4px)' }}>
          평균 {eta}
        </div>
      </div>
      <div style={{ padding: '20px 4px 4px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--uw-ink)' }}>{office}</div>
        <div style={{ fontSize: 13, color: 'var(--uw-slate)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Ic.pin /> {area} <span style={{ color: 'var(--uw-border-strong)' }}>|</span> <Ic.star /> {rating} <span style={{ opacity: 0.7 }}>({count})</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16 }}>
          <div className="uw-tabular" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--uw-ink)' }}>
            {price}<span style={{ fontSize: 14, color: 'var(--uw-slate)', fontWeight: 600 }}>원~</span>
          </div>
          <span className="uw-badge uw-badge-success">예약 가능</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="uw-container">
      {/* Hero */}
      <div className="uw-hero">
        <div className="animate-slide-up">
          <div className="uw-badge uw-badge-brand" style={{ marginBottom: '24px', padding: '6px 14px', height: 'auto', fontSize: '13px' }}>
            <span className="uw-badge-dot" style={{ background: 'var(--uw-brand)' }} />
            전국 1,200곳의 법무사가 입점
          </div>
          <h1 className="uw-hero-title">
            법인 등기,<br/>
            <span>5분</span>이면 시작.
          </h1>
          <p className="uw-hero-desc">
            동네 법무사 사무소를 한눈에 비교하고, 카톡으로 서류받고, 등기까지 비대면으로. 평균 처리 6시간.
          </p>
          
          <div className="uw-search-box">
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
              <Ic.search />
              <input 
                type="text"
                placeholder="어떤 등기가 필요하세요? 예) 본점 이전" 
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '16px', fontWeight: 500, color: 'var(--uw-ink)' }}
              />
            </div>
            <button className="uw-btn uw-btn-brand uw-btn-lg" style={{ minWidth: '120px' }}>
              찾아보기 <Ic.arrow />
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
            {['법인 설립', '본점 이전', '임원 변경', '자본금 증자', '상호 변경', '청산'].map(t => (
              <button key={t} className="uw-btn uw-btn-outline uw-btn-sm" style={{ borderRadius: '999px' }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Right — featured law office card stack */}
        <div style={{ position: 'relative', height: '520px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} className="animate-fade-in">
          <div style={{ position: 'absolute', width: '100%', height: '100%', background: 'radial-gradient(circle, var(--uw-brand-soft) 0%, transparent 70%)', zIndex: -1, transform: 'scale(1.2)' }} />
          
          <FeaturedOfficeCard
            style={{ position: 'absolute', top: 40, left: 0, width: 320, transform: 'rotate(-4deg)', zIndex: 1, opacity: 0.9 }}
            office="해담 법무사" area="서울 강남" rating={4.9} count={428} price="33,000" eta="4시간"
            tagColor="linear-gradient(135deg, #c4b5fd, #a78bfa)"
          />
          <FeaturedOfficeCard
            style={{ position: 'absolute', bottom: 20, right: 0, width: 300, transform: 'rotate(5deg)', zIndex: 2, opacity: 0.95 }}
            office="청람 법무사" area="경기 성남" rating={4.8} count={314} price="35,000" eta="5시간"
            tagColor="linear-gradient(135deg, #86efac, #4ade80)"
          />
          <FeaturedOfficeCard
            style={{ position: 'relative', zIndex: 3, width: 340, transform: 'translateY(-10px)' }}
            office="이로운 법무법인" area="서울 마포" rating={4.9} count={892} price="29,000" eta="3시간"
            featured tagColor="linear-gradient(135deg, var(--uw-brand), #818cf8)"
          />
        </div>
      </div>

      {/* Trust bar */}
      <div className="uw-card" style={{ marginTop: '40px', padding: '40px 60px', display: 'flex', justifyContent: 'space-between', gap: '40px', background: 'var(--uw-ink)', color: 'white' }}>
        {[
          { n: '12,400+', t: '누적 등기 처리' },
          { n: '평균 6시간', t: '신청 → 완료' },
          { n: '4.9 / 5.0', t: '실 사용자 평점' },
          { n: '1,200+', t: '입점 법무사 사무소' },
        ].map(x => (
          <div key={x.n} style={{ textAlign: 'center' }}>
            <div className="uw-tabular" style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>{x.n}</div>
            <div style={{ fontSize: '14px', color: 'var(--uw-fog)', fontWeight: 500 }}>{x.t}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div style={{ marginTop: '120px' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <div className="ar-eyebrow" style={{ color: 'var(--uw-brand)', marginBottom: '12px' }}>How it works</div>
          <h2 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-0.025em', margin: 0 }}>비대면으로, 4단계면 끝.</h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          {[
            { n: '01', t: '필요한 등기 선택', d: '간단한 질문에 답하면 필요한 등기 종류와 서류를 AI가 안내해드려요.' },
            { n: '02', t: '법무사 비교 및 선택', d: '가까운 사무소를 평점, 견적, 처리시간 순으로 한눈에 비교하세요.' },
            { n: '03', t: '카톡으로 서류 제출', d: '신분증과 서류를 스마트폰으로 찍어 보내면 끝. 팩스나 방문이 필요없어요.' },
            { n: '04', t: '등기부 도착', d: '평균 6시간. 등기가 완료되면 변경된 등기부등본을 PDF로 바로 보내드려요.' },
          ].map((s, i) => (
            <div key={s.n} className="uw-card" style={{ padding: '32px 24px', background: i === 0 ? 'var(--uw-brand)' : 'var(--uw-bg)', color: i === 0 ? 'white' : 'var(--uw-ink)', borderColor: i === 0 ? 'var(--uw-brand)' : 'var(--uw-border)', borderTopWidth: i !== 0 ? '4px' : '1px', borderTopColor: i !== 0 ? 'var(--uw-brand-soft)' : 'var(--uw-brand)' }}>
              <div className="uw-tabular" style={{ fontSize: '16px', fontWeight: 800, color: i === 0 ? 'rgba(255,255,255,0.8)' : 'var(--uw-brand)', marginBottom: '20px' }}>{s.n}</div>
              <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.015em', marginBottom: '12px' }}>{s.t}</div>
              <div style={{ fontSize: '15px', lineHeight: 1.6, color: i === 0 ? 'rgba(255,255,255,0.9)' : 'var(--uw-slate)' }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
