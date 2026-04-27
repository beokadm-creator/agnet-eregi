import React from "react";
import { useAppContext } from "../../context/AppContext";

export default function LogViewer() {
  const { log } = useAppContext();
  return (
    <div style={{ marginBottom: 20, padding: 12, background: "#e0f2f1", borderRadius: 8, color: "#004d40", fontSize: "0.9em" }}>
      <strong>Log:</strong> {log}
    </div>
  );
}
