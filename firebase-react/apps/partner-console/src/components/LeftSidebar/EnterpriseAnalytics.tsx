import React, { useState, useEffect } from "react";

export const EnterpriseAnalytics: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAnalytics = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("jwt_token") || "";
      const res = await fetch("http://localhost:5001/agentregi/us-central1/api/v1/partner/analytics", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to load analytics");
      }
      setStats(data.data);
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
    return <div className="p-4 text-gray-500">Loading analytics...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!stats) {
    return <div className="p-4 text-gray-500">No data available</div>;
  }

  return (
    <div className="p-4 bg-white rounded shadow text-sm">
      <h2 className="text-lg font-bold mb-4">엔터프라이즈 통계 (Enterprise Analytics)</h2>
      
      <div className="mb-6">
        <h3 className="font-semibold mb-2">일간 통계 (최근 7일)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.daily.map((day: any, idx: number) => (
            <div key={idx} className="border p-3 rounded bg-gray-50">
              <div className="font-bold text-gray-700">{day.date}</div>
              <div className="text-gray-600 mt-1">완료 케이스: {day.casesCompleted}</div>
              <div className="text-gray-600">수익: ₩{day.revenue.toLocaleString()}</div>
              <div className="text-gray-600">SLA 위반: {day.slaViolations}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">주간 통계 (최근 4주)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.weekly.map((week: any, idx: number) => (
            <div key={idx} className="border p-3 rounded bg-blue-50">
              <div className="font-bold text-blue-800">{week.week}</div>
              <div className="text-gray-600 mt-1">완료 케이스: {week.casesCompleted}</div>
              <div className="text-gray-600">수익: ₩{week.revenue.toLocaleString()}</div>
              <div className="text-gray-600">SLA 위반: {week.slaViolations}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
