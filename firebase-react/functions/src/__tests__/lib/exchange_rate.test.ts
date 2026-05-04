import { getExchangeRate, convertCurrency, fetchRealExchangeRates, MOCK_EXCHANGE_RATES } from "../../lib/exchange_rate";
import * as admin from "firebase-admin";
import axios from "axios";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock admin
jest.mock("firebase-admin", () => {
  const mockGet = jest.fn();
  const mockSet = jest.fn();
  const mockDoc = jest.fn(() => ({
    get: mockGet,
    set: mockSet
  }));
  const mockCollection = jest.fn(() => ({
    doc: mockDoc
  }));

  const mockFirestore = jest.fn(() => ({
    collection: mockCollection
  })) as any;
  mockFirestore.FieldValue = {
    serverTimestamp: jest.fn(() => "MOCK_TIMESTAMP")
  };

  return {
    firestore: mockFirestore,
    _mockGet: mockGet,
    _mockSet: mockSet
  };
});

describe("exchange_rate", () => {
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet = (admin as any)._mockGet;
    mockSet = (admin as any)._mockSet;
  });

  describe("fetchRealExchangeRates", () => {
    it("should return cached rates if fresh", async () => {
      const mockRates = { KRW: 1, USD: 1300, JPY: 9.5 };
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          rates: mockRates,
          updatedAt: { toDate: () => new Date(Date.now() - 30 * 60 * 1000) } // 30 minutes ago
        })
      });

      const result = await fetchRealExchangeRates();
      expect(result).toEqual(mockRates);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("should fetch new rates from API if cache is old", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          rates: MOCK_EXCHANGE_RATES,
          updatedAt: { toDate: () => new Date(Date.now() - 2 * 60 * 60 * 1000) } // 2 hours ago
        })
      });

      mockedAxios.get.mockResolvedValue({
        data: {
          rates: {
            KRW: 1400, // 1 EUR = 1400 KRW
            USD: 1.1,  // 1 EUR = 1.1 USD
            JPY: 150   // 1 EUR = 150 JPY
          }
        }
      });

      const result = await fetchRealExchangeRates();
      
      expect(mockedAxios.get).toHaveBeenCalledWith("https://api.frankfurter.app/latest");
      
      // Expected calculations:
      // 1 USD = (1400 / 1.1) KRW = ~1272.72 KRW
      // 1 JPY = (1400 / 150) KRW = ~9.33 KRW
      expect(result.KRW).toBe(1);
      expect(result.USD).toBeCloseTo(1400 / 1.1);
      expect(result.JPY).toBeCloseTo(1400 / 150);

      expect(mockSet).toHaveBeenCalledWith({
        rates: expect.any(Object),
        updatedAt: "MOCK_TIMESTAMP"
      }, { merge: true });
    });

    it("should fallback to MOCK_EXCHANGE_RATES if API fails", async () => {
      mockGet.mockResolvedValue({ exists: false });
      mockedAxios.get.mockRejectedValue(new Error("API Down"));

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await fetchRealExchangeRates();
      
      expect(result).toEqual(MOCK_EXCHANGE_RATES);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("환율 API 호출 실패"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("getExchangeRate", () => {
    it("should return the correct exchange rate", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          rates: { KRW: 1, USD: 1300, JPY: 10 },
          updatedAt: { toDate: () => new Date() }
        })
      });

      const rate = await getExchangeRate("USD", "KRW");
      expect(rate).toBe(1300); // 1 USD = 1300 KRW
    });
  });

  describe("convertCurrency", () => {
    it("should convert correctly between currencies", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          rates: { KRW: 1, USD: 1300, JPY: 10 },
          updatedAt: { toDate: () => new Date() }
        })
      });

      // 100 USD to KRW = 100 * 1300 = 130,000 KRW
      const usdToKrw = await convertCurrency(100, "USD", "KRW");
      expect(usdToKrw).toBe(130000);

      // 13,000 KRW to USD = 13,000 / 1300 = 10 USD
      const krwToUsd = await convertCurrency(13000, "KRW", "USD");
      expect(krwToUsd).toBe(10);

      // 100 USD to JPY = 100 * (1300 / 10) = 13,000 JPY
      const usdToJpy = await convertCurrency(100, "USD", "JPY");
      expect(usdToJpy).toBe(13000);
    });

    it("should handle same currency conversion", async () => {
      const result = await convertCurrency(500, "KRW", "krw");
      expect(result).toBe(500);
      expect(mockGet).not.toHaveBeenCalled(); // Fast path
    });
  });
});
