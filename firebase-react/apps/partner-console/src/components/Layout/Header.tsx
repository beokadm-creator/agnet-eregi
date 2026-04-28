import { useTranslation } from "react-i18next";

export default function Header() {
  const { t, i18n } = useTranslation();
  return (
    <header className="im-header">
      <h1 className="im-title">{t("title")}</h1>
      <div className="im-lang">
        <button
          onClick={() => i18n.changeLanguage("ko")}
          className={`im-link${i18n.language?.startsWith("ko") ? " im-link--active" : ""}`}
          type="button"
        >
          KO
        </button>
        <span aria-hidden="true">·</span>
        <button
          onClick={() => i18n.changeLanguage("en")}
          className={`im-link${i18n.language?.startsWith("en") ? " im-link--active" : ""}`}
          type="button"
        >
          EN
        </button>
      </div>
    </header>
  );
}
