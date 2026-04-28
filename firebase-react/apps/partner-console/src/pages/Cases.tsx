import CaseList from "../components/LeftSidebar/CaseList";
import RightPanel from "../components/Layout/RightPanel";

export default function Cases() {
  return (
    <div className="im-split" style={{ alignItems: 'flex-start' }}>
      <div className="im-panel" style={{ flex: '0 0 320px' }}>
        <CaseList />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <RightPanel />
      </div>
    </div>
  );
}
