import OrganizationSettings from "../components/LeftSidebar/OrganizationSettings";
import TeamMembers from "../components/LeftSidebar/TeamMembers";

export default function Organization() {
  return (
    <>
      <div className="im-panel">
        <OrganizationSettings />
      </div>
      <div className="im-panel">
        <TeamMembers />
      </div>
    </>
  );
}
