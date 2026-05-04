import { useAppContext } from "../../context/AppContext";

export default function LogViewer() {
  const { log } = useAppContext();
  return (
    <div className="im-log">
      <span className="font-medium text-[var(--text-primary)]">Log</span>
      <span className="text-[var(--text-tertiary)]"> · </span>
      {log}
    </div>
  );
}
