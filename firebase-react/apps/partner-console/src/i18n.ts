import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      title: "AgentRegi Partner Console",
      auth_load: "Auth & Load Data"
    }
  },
  ko: {
    translation: {
      title: "AgentRegi 파트너 콘솔",
      auth_load: "인증 및 데이터 로드"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "ko",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
