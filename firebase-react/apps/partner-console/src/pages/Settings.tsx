import NotificationSettings from "../components/LeftSidebar/NotificationSettings";
import B2gCredentials from "../components/LeftSidebar/B2gCredentials";
import SecuritySettings from "../components/LeftSidebar/SecuritySettings";
import DeveloperSettings from "../components/LeftSidebar/DeveloperSettings";

export default function Settings() {
  return (
    <>
      <div className="im-panel">
        <NotificationSettings />
      </div>
      <div className="im-panel">
        <B2gCredentials />
      </div>
      <div className="im-panel">
        <SecuritySettings />
      </div>
      <div className="im-panel">
        <DeveloperSettings />
      </div>
    </>
  );
}
