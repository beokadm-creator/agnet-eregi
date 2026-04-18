import { useEffect } from "react";

interface Props {
  message: string;
  onRetry?: () => void;
  onClose: () => void;
}

export function InlineError({ message, onRetry, onClose }: Props) {
  useEffect(() => {
    // Auto-dismiss after 5 seconds if no retry is provided
    if (!onRetry) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, onRetry, onClose]);

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "space-between", 
      background: "#fff2f0", 
      border: "1px solid #ffccc7", 
      borderRadius: 6, 
      padding: "8px 12px", 
      marginBottom: 12,
      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
    }}>
      <div style={{ color: "#cf1322", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <span>{message}</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {onRetry && (
          <button 
            onClick={onRetry}
            style={{ padding: "4px 8px", background: "#ff4d4f", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
          >
            다시 시도
          </button>
        )}
        <button 
          onClick={onClose}
          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 16, color: "#999", padding: "0 4px" }}
          aria-label="닫기"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
