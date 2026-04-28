import { useAppContext } from "../../context/AppContext";
import QuotesManager from "../RightPanel/QuotesManager";
import EvidencesManager from "../RightPanel/EvidencesManager";
import EvidenceRequestsManager from "../RightPanel/EvidenceRequestsManager";
import PackagesManager from "../RightPanel/PackagesManager";
import RefundsManager from "../RightPanel/RefundsManager";
import B2gSubmissions from "../RightPanel/B2gSubmissions";
import CaseHeader from "../RightPanel/CaseHeader";
import CaseWorkboardWrapper from "../RightPanel/CaseWorkboardWrapper";

export default function RightPanel() {
  const { selectedCase } = useAppContext();

  if (!selectedCase) return null;

  return (
    <div style={{ flex: 2, background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #ddd" }}>
      <CaseHeader />
      <CaseWorkboardWrapper />
      <QuotesManager />
      <EvidencesManager />
      <EvidenceRequestsManager />
      <PackagesManager />
      <RefundsManager />
      <B2gSubmissions />
    </div>
  );
}
