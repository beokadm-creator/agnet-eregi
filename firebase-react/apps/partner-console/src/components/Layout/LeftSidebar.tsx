import React from "react";
import QualityTier from "../LeftSidebar/QualityTier";
import CaseList from "../LeftSidebar/CaseList";
import NotificationSettings from "../LeftSidebar/NotificationSettings";
import B2gCredentials from "../LeftSidebar/B2gCredentials";
import SettlementsAndAds from "../LeftSidebar/SettlementsAndAds";
import Subscriptions from "../LeftSidebar/Subscriptions";
import TeamMembers from "../LeftSidebar/TeamMembers";
import SecuritySettings from "../LeftSidebar/SecuritySettings";
import DeveloperSettings from "../LeftSidebar/DeveloperSettings";
import OrganizationSettings from "../LeftSidebar/OrganizationSettings";
import TemplateManager from "../LeftSidebar/TemplateManager";

export default function LeftSidebar() {
  return (
    <div style={{ flex: 1, background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #ddd" }}>
      <OrganizationSettings />
      <QualityTier />
      <CaseList />
      <NotificationSettings />
      <B2gCredentials />
      <SettlementsAndAds />
      <Subscriptions />
      <TeamMembers />
      <SecuritySettings />
      <DeveloperSettings />
      <TemplateManager />
    </div>
  );
}
