import React from "react";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="uw-container" style={{ textAlign: "center", paddingTop: "120px", paddingBottom: "120px" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto" }} className="animate-slide-up">
        <div style={{ fontSize: "120px", fontWeight: "800", color: "var(--uw-brand)", lineHeight: "1", marginBottom: "24px" }}>
          404
        </div>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--uw-ink)", marginBottom: "16px" }}>
          페이지를 찾을 수 없습니다
        </h1>
        <p style={{ fontSize: "16px", color: "var(--uw-slate)", lineHeight: "1.6", marginBottom: "40px" }}>
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          <br />
          URL을 확인하시거나 대시보드로 돌아갈 수 있습니다.
        </p>
        <button
          onClick={() => navigate("/")}
          className="uw-btn uw-btn-brand"
          style={{ width: "100%", maxWidth: "200px" }}
        >
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  );
}
