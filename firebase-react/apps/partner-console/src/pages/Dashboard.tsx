import { EnterpriseAnalytics } from "../components/LeftSidebar/EnterpriseAnalytics";
import QualityTier from "../components/LeftSidebar/QualityTier";

export default function Dashboard() {
  return (
    <>
      <div className="im-panel">
        <EnterpriseAnalytics />
      </div>
      <div className="im-panel">
        <QualityTier />
      </div>
    </>
  );
}
