import React from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../context/AppContext";

export default function Header() {
  const { t, i18n } = useTranslation();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <h1 style={{ color: "#00695c", margin: 0 }}>{t('title')}</h1>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => i18n.changeLanguage('ko')} style={{ padding: "6px 12px", cursor: "pointer", fontWeight: i18n.language?.startsWith('ko') ? 'bold' : 'normal' }}>KO</button>
        <button onClick={() => i18n.changeLanguage('en')} style={{ padding: "6px 12px", cursor: "pointer", fontWeight: i18n.language?.startsWith('en') ? 'bold' : 'normal' }}>EN</button>
      </div>
    </div>
  );
}
