import React, { useState, useEffect } from "react";
import { getApi } from "../../services/api";

export const EnterpriseAnalytics: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAnalytics = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getApi().get("/v1/partner/analytics");
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return <div className="p-4 text-[var(--text-tertiary)]">Loading analytics...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!stats) {
    return <div className="p-4 text-[var(--text-tertiary)]">No data available</div>;
  }

  return (
    <div className="p-4 bg-[var(--surface)] rounded shadow-none text-sm">
      <h2 className="text-lg font-bold mb-4 font-['Hahmlet']">엔터프라이즈 통계 (Enterprise Analytics)</h2>
      
      <div className="mb-6">
        <h3 className="font-semibold mb-2 font-['Hahmlet']">일간 통계 (최근 7일)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.daily.map((day: any, idx: number) => (
            <div key={idx} className="border p-3 rounded bg-[var(--bg)]">
              <div className="font-bold text-[var(--text-secondary)]">{day.date}</div>
              <div className="text-[var(--text-secondary)] mt-1">완료 케이스: {day.casesCompleted}</div>
              <div className="text-[var(--text-secondary)]">수익: ₩{day.revenue.toLocaleString()}</div>
              <div className="text-[var(--text-secondary)]">SLA 위반: {day.slaViolations}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2 font-['Hahmlet']">주간 통계 (최근 4주)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.weekly.map((week: any, idx: number) => (
            <div key={idx} className="border p-3 rounded bg-[var(--brand)]/10">
              <div className="font-bold text-[var(--brand)]">{week.week}</div>
              <div className="text-[var(--text-secondary)] mt-1">완료 케이스: {week.casesCompleted}</div>
              <div className="text-[var(--text-secondary)]">수익: ₩{week.revenue.toLocaleString()}</div>
              <div className="text-[var(--text-secondary)]">SLA 위반: {week.slaViolations}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
