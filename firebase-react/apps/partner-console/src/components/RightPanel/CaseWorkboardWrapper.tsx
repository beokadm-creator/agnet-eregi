import CompletionPanel from "../CaseWorkboard/CompletionPanel";
import { useAppContext } from "../../context/AppContext";

export default function CaseWorkboardWrapper() {
  const { selectedCase, setLog, busy } = useAppContext();

  if (!selectedCase) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      {selectedCase.status === 'ready' && (
        <CompletionPanel 
          caseId={selectedCase.id} 
          onLog={setLog}
          busy={busy}
        />
      )}
    </div>
  );
}
