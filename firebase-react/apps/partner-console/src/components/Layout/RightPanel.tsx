import { useAppContext } from "../../context/AppContext";
import QuotesManager from "../RightPanel/QuotesManager";
import EvidencesManager from "../RightPanel/EvidencesManager";
import EvidenceRequestsManager from "../RightPanel/EvidenceRequestsManager";
import PackagesManager from "../RightPanel/PackagesManager";
import RefundsManager from "../RightPanel/RefundsManager";
import DocumentsReview from "../RightPanel/DocumentsReview";
import B2gSubmissions from "../RightPanel/B2gSubmissions";
import CaseHeader from "../RightPanel/CaseHeader";
import WorkflowTransitions from "../RightPanel/WorkflowTransitions";
import CaseWorkboardWrapper from "../RightPanel/CaseWorkboardWrapper";

export default function RightPanel() {
  const { selectedCase } = useAppContext();

  if (!selectedCase) return null;

  return (
    <div style={{ 
      flex: 1, 
      display: "flex", 
      flexDirection: "column", 
      gap: 24, 
      padding: 32, 
      overflowY: "auto",
      background: "var(--pc-bg)"
    }}>
      <CaseHeader />
      <WorkflowTransitions />
      <CaseWorkboardWrapper />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <QuotesManager />
          <EvidencesManager />
          <EvidenceRequestsManager />
          <PackagesManager />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <RefundsManager />
          <DocumentsReview />
          <B2gSubmissions />
        </div>
      </div>
    </div>
  );
}
