import Subscriptions from "../components/LeftSidebar/Subscriptions";
import SettlementsAndAds from "../components/LeftSidebar/SettlementsAndAds";

export default function Billing() {
  return (
    <>
      <div className="im-panel">
        <Subscriptions />
      </div>
      <div className="im-panel">
        <SettlementsAndAds />
      </div>
    </>
  );
}
