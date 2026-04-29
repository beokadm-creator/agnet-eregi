import React, { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { EnterpriseAnalytics } from '../components/LeftSidebar/EnterpriseAnalytics';
import QualityTier from '../components/LeftSidebar/QualityTier';

function KpiTile({
  label, value, hint, up, accent, prefix, suffix
}: {
  label: string; value: string; hint?: string;
  up?: boolean; accent?: boolean; prefix?: string; suffix?: string;
}) {
  return (
    <div className={`pc-kpi-tile${accent ? ' pc-kpi-accent' : ''}`}>
      <div className="pc-kpi-label">{label}</div>
      <div className="pc-kpi-value">
        {prefix}<span>{value}</span>{suffix}
      </div>
      {hint && (
        <div className="pc-kpi-hint">
          {up !== undefined && (
            <span className={up ? 'pc-kpi-up' : 'pc-kpi-down'}>
              {up ? '▲' : '▼'}
            </span>
          )}
          {hint}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ icon, title, sub, badge, badgeClass, time }: {
  icon: string; title: string; sub?: string;
  badge?: string; badgeClass?: string; time: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 0', borderBottom: '1px solid var(--pc-border)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'var(--pc-surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pc-text)', lineHeight: 1.3 }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {badge && (
        <span className={`pc-badge ${badgeClass || 'pc-badge-neutral'}`}>{badge}</span>
      )}
      <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', flexShrink: 0 }}>{time}</div>
    </div>
  );
}

export default function Dashboard() {
  const { cases, loadCases, busy } = useAppContext();

  useEffect(() => {
    loadCases();
  }, []);

  const activeCases = cases.filter((c) => c?.status !== 'DONE' && c?.status !== 'CANCELLED').length;
  const doneCases = cases.filter((c) => c?.status === 'DONE').length;

  return (
    <div className="pc-page">
      {/* Header */}
      <div className="pc-page-header">
        <div>
          <div className="pc-eyebrow" style={{ marginBottom: 6 }}>파트너 대시보드</div>
          <h1 className="pc-page-title">실적 및 품질 현황</h1>
          <p className="pc-page-sub">오늘 기준 실시간 업데이트</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="pc-btn" onClick={loadCases} disabled={busy}>
            {busy ? '갱신 중…' : '↻ 새로고침'}
          </button>
          <button className="pc-btn pc-btn-brand">
            + 사건 등록
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="pc-kpi-grid">
        <KpiTile
          label="진행 중인 사건"
          value={String(activeCases)}
          hint="현재 처리 대기 및 진행 중"
          suffix="건"
          up={true}
        />
        <KpiTile
          label="이번 주 완료"
          value={String(doneCases)}
          hint="전주 대비 +12%"
          suffix="건"
          up={true}
        />
        <KpiTile
          label="이번 주 매출"
          value="4.2M"
          prefix="₩"
          hint="전주 대비 +8%"
          up={true}
        />
        <KpiTile
          label="SLA 준수율"
          value="98.4%"
          hint="목표 95% 이상 · 품질 등급 A"
          accent
        />
      </div>

      {/* Two column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Analytics */}
        <div className="pc-section">
          <div className="pc-section-header">
            <h2 className="pc-section-title">최근 실적</h2>
            <button className="pc-btn" style={{ padding: "4px 8px" }}>전체 보기 →</button>
          </div>
          <div className="pc-section-body" style={{ padding: '0 24px 20px' }}>
            <EnterpriseAnalytics />
          </div>
        </div>

        {/* Activity Feed */}
        <div className="pc-section">
          <div className="pc-section-header">
            <h2 className="pc-section-title">최근 활동</h2>
          </div>
          <div style={{ padding: '4px 24px 8px' }}>
            <ActivityRow
              icon="📄"
              title="(주)호두컴퍼니 — 본점 이전 서류 제출"
              sub="김민수 · case_a8f3c2"
              badge="서류 검토"
              badgeClass="pc-badge-warning"
              time="12분 전"
            />
            <ActivityRow
              icon="✅"
              title="(주)스카이런 — 임원 변경 완료"
              sub="박지영 · case_b9d1a4"
              badge="완료"
              badgeClass="pc-badge-success"
              time="1시간 전"
            />
            <ActivityRow
              icon="⚠️"
              title="(주)오로라랩 — 보완 요청 1건"
              sub="최서윤 · case_c2e5f8"
              badge="보완 요청"
              badgeClass="pc-badge-danger"
              time="2시간 전"
            />
            <ActivityRow
              icon="💬"
              title="신규 의뢰 도착 — 자본금 증자"
              sub="이도윤 · 새 케이스"
              badge="신규"
              badgeClass="pc-badge-brand"
              time="3시간 전"
            />
            <ActivityRow
              icon="🔔"
              title="정산 완료 — 4월 2주차"
              sub="₩1,240,000 정산됨"
              time="어제"
            />
          </div>
        </div>
      </div>

      {/* Quality Tier */}
      <div className="pc-section">
        <div className="pc-section-header">
          <h2 className="pc-section-title">품질 등급 및 랭킹</h2>
          <span className="pc-badge pc-badge-success">
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 4 }} />
            등급 A
          </span>
        </div>
        <div className="pc-section-body">
          <QualityTier />
        </div>
      </div>
    </div>
  );
}
