import * as admin from "firebase-admin";

export interface TelegramSettings {
  enabled: boolean;
  botToken: string; // Secret
  chatId: string;
  webhookToken: string; // Shared secret for incoming webhooks
  updatedAt: admin.firestore.Timestamp;
  updatedBy: string;
}

export interface TossPaymentsSettings {
  enabled: boolean;
  clientKey: string;
  secretKey: string; // Secret
  updatedAt: admin.firestore.Timestamp;
  updatedBy: string;
}

export type LlmProvider = "glm";

export interface LlmSettings {
  enabled: boolean;
  provider: LlmProvider;
  model: string;
  endpoint: string;
  apiKeySecretName: string; // Secret Manager resource name
  updatedAt: admin.firestore.Timestamp;
  updatedBy: string;
}

export interface PricingBenchmarkItem {
  scenarioKey: string;
  region: string;
  minFee: number;
  avgFee: number;
  maxFee: number;
  officialCostIncluded: boolean;
  sourceLabel: string;
  sourceUrl: string;
  note?: string;
}

export interface PricingBenchmarksSettings {
  items: PricingBenchmarkItem[];
  updatedAt: admin.firestore.Timestamp;
  updatedBy: string;
}

export const DEFAULT_PRICING_BENCHMARKS: PricingBenchmarkItem[] = [
  {
    scenarioKey: "corp_establishment",
    region: "KR",
    minFee: 395900,
    avgFee: 520000,
    maxFee: 650000,
    officialCostIncluded: true,
    sourceLabel: "헬프미/회사등기 공개가 기준",
    sourceUrl: "https://reg.help-me.kr/pricing/%EB%B2%95%EC%9D%B8%EC%84%A4%EB%A6%BD/%EC%A3%BC%EC%8B%9D%ED%9A%8C%EC%82%AC-%EC%9D%BC%EB%B0%98",
    note: "초기 공개 견적 기준값입니다. 자본금, 지역, 과밀억제권역 여부에 따라 달라질 수 있습니다.",
  },
];

export const getOpsSettingsCollection = () => admin.firestore().collection("ops_settings");
