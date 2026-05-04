import * as admin from "firebase-admin";
import axios from "axios";

export const MOCK_EXCHANGE_RATES: Record<string, number> = {
  KRW: 1,
  USD: 1350,
  JPY: 9,
  EUR: 1450,
};

/**
 * 외부 공공 환율 API(Frankfurter)를 통해 실시간 환율을 조회합니다.
 * 호출 제한이나 속도 개선을 위해 Firestore에 1시간 동안 캐시합니다.
 */
export async function fetchRealExchangeRates(): Promise<Record<string, number>> {
  const db = admin.firestore();
  const cacheRef = db.collection("ops_settings").doc("exchange_rates");

  try {
    const doc = await cacheRef.get();
    if (doc.exists) {
      const data = doc.data()!;
      const updatedAt = data.updatedAt?.toDate() || new Date(0);
      const isFresh = (Date.now() - updatedAt.getTime()) < 60 * 60 * 1000; // 1 hour

      if (isFresh && data.rates) {
        return data.rates as Record<string, number>;
      }
    }

    // API 호출 (Base: EUR, Frankfurter는 무료/제한없음)
    // 변환 공식: (1 EUR / x 통화) 를 활용하여 KRW 기준 배수로 맞춥니다.
    const res = await axios.get("https://api.frankfurter.app/latest");
    const baseRates = res.data.rates; // EUR 기준 각국 통화
    baseRates["EUR"] = 1; // Base

    const krwRateToEur = baseRates["KRW"] || MOCK_EXCHANGE_RATES.EUR;

    // KRW 1단위 기준으로 역산하여 저장 (1 USD = ? KRW)
    const newRates: Record<string, number> = { KRW: 1 };
    for (const currency in baseRates) {
      if (currency === "KRW") continue;
      // 1 EUR = X USD = Y KRW  => 1 USD = Y/X KRW
      newRates[currency] = krwRateToEur / baseRates[currency];
    }

    await cacheRef.set({
      rates: newRates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return newRates;

  } catch (error) {
    console.warn("환율 API 호출 실패, Mock 환율로 Fallback 합니다.", error);
    return MOCK_EXCHANGE_RATES;
  }
}

export async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) return 1;
  
  // 실시간 환율 적용
  const rates = await fetchRealExchangeRates();
  
  // 기준 통화(KRW)를 거쳐서 환율 계산
  const fromRate = rates[from] || MOCK_EXCHANGE_RATES[from] || 1;
  const toRate = rates[to] || MOCK_EXCHANGE_RATES[to] || 1;
  
  return fromRate / toRate;
}

export async function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return Math.round(amount * rate * 100) / 100; // 소수점 2자리까지 유지
}
