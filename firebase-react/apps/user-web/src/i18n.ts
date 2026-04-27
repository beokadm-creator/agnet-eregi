import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      title: "AgentRegi User Console",
      auth_load: "Auth & Load Data",
      funnel_title: "Diagnosis (Funnel) & Matching",
      funnel_placeholder: "e.g. I want to register a change of executives",
      funnel_start: "Start Diagnosis",
      my_submissions: "My Submissions",
      refresh: "Refresh",
      pack_placeholder: "Select Case Category (Case Pack)",
      legacy_placeholder: "Or enter directly (Legacy type)",
      payload_placeholder: "Initial Payload (JSON or text)",
      submit_now: "Submit immediately (Skip Draft)",
      create_new: "Create New",
      empty_submissions: "No submission history."
    }
  },
  ko: {
    translation: {
      title: "AgentRegi 사용자 콘솔",
      auth_load: "인증 및 데이터 로드",
      funnel_title: "진단 (Funnel) 및 매칭 (EP-01, EP-02)",
      funnel_placeholder: "예: 임원 변경 등기 하고 싶어요",
      funnel_start: "진단 시작",
      my_submissions: "내 제출 목록",
      refresh: "새로고침",
      pack_placeholder: "사건 카테고리 선택 (Case Pack)",
      legacy_placeholder: "또는 직접 입력 (Legacy type)",
      payload_placeholder: "초기 Payload (JSON or text)",
      submit_now: "즉시 제출 (Draft 건너뛰기)",
      create_new: "새로 만들기",
      empty_submissions: "제출 내역이 없습니다."
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "ko", // 기본 언어
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
