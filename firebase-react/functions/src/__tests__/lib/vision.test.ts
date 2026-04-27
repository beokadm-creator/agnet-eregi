import { validateDocument, extractTextFromImage } from "../../lib/vision";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { checkAndRecordUsage } from "../../lib/quota";

// Mock Google Cloud Vision
jest.mock("@google-cloud/vision");
jest.mock("../../lib/quota", () => ({
  checkAndRecordUsage: jest.fn()
}));

describe("vision", () => {
  describe("extractTextFromImage", () => {
    const partnerId = "partner_1";
    let mockTextDetection: jest.Mock;

    beforeAll(() => {
      mockTextDetection = jest.fn();
      (ImageAnnotatorClient as unknown as jest.Mock).mockImplementation(() => ({
        textDetection: mockTextDetection
      }));
    });

    beforeEach(() => {
      mockTextDetection.mockReset();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should extract text successfully", async () => {
      (checkAndRecordUsage as jest.Mock).mockResolvedValueOnce(true);
      mockTextDetection.mockResolvedValue([
        { textAnnotations: [{ description: "테스트 문서 텍스트" }] }
      ]);

      const text = await extractTextFromImage(partnerId, "gs://bucket/test.jpg");
      expect(text).toBe("테스트 문서 텍스트");
      expect(checkAndRecordUsage).toHaveBeenCalledWith(partnerId, "ocr", 500);
      expect(mockTextDetection).toHaveBeenCalledWith("gs://bucket/test.jpg");
    });

    it("should return empty string if no annotations", async () => {
      (checkAndRecordUsage as jest.Mock).mockResolvedValueOnce(true);
      mockTextDetection.mockResolvedValue([
        { textAnnotations: [] }
      ]);

      const text = await extractTextFromImage(partnerId, "gs://bucket/test.jpg");
      expect(text).toBe("");
    });

    it("should throw error on API failure", async () => {
      (checkAndRecordUsage as jest.Mock).mockResolvedValueOnce(true);
      mockTextDetection.mockRejectedValue(new Error("API Error"));

      await expect(extractTextFromImage(partnerId, "gs://bucket/test.jpg")).rejects.toThrow("OCR 추출에 실패했습니다.");
    });

    it("should block extraction when quota is exceeded", async () => {
      (checkAndRecordUsage as jest.Mock).mockResolvedValueOnce(false);

      await expect(extractTextFromImage(partnerId, "gs://bucket/test.jpg")).rejects.toThrow("OCR 추출 할당량을 초과했습니다.");
      expect(mockTextDetection).not.toHaveBeenCalled();
    });
  });

  describe("validateDocument", () => {
    it("should validate BUSINESS_LICENSE correctly", () => {
      const validText = "사업자등록증 등록번호 123-45-67890 상호 (주)에이전트 대표자 김대표 개업연월일 2024년 1월 1일";
      const result = validateDocument(validText, "BUSINESS_LICENSE");
      expect(result.isValid).toBe(true);
      expect(result.missingKeywords.length).toBe(0);
    });

    it("should fail BUSINESS_LICENSE if keywords are missing", () => {
      const invalidText = "등록번호 123-45-67890 상호 (주)에이전트";
      const result = validateDocument(invalidText, "BUSINESS_LICENSE");
      expect(result.isValid).toBe(false);
      expect(result.missingKeywords).toContain("사업자등록증");
      expect(result.missingKeywords).toContain("대표자");
    });

    it("should validate ID_CARD (Resident Card) correctly", () => {
      const validText = "주민등록증 홍길동 900101-1234567 서울특별시 강남구 발급일자 2020년 1월 1일";
      const result = validateDocument(validText, "ID_CARD");
      expect(result.isValid).toBe(true);
    });

    it("should validate ID_CARD (Driver License) correctly", () => {
      const validText = "자동차운전면허증 서울 11-22-333333-44 적성검사 기간 2030년";
      const result = validateDocument(validText, "ID_CARD");
      expect(result.isValid).toBe(true);
    });

    it("should fail ID_CARD if no valid keywords match", () => {
      const invalidText = "여권 대한민국 KOR";
      const result = validateDocument(invalidText, "ID_CARD");
      expect(result.isValid).toBe(false);
      expect(result.missingKeywords).toContain("주민등록증/운전면허증 필수 항목");
    });

    it("should pass unknown document types automatically", () => {
      const text = "알 수 없는 문서입니다.";
      const result = validateDocument(text, "UNKNOWN_TYPE");
      expect(result.isValid).toBe(true);
      expect(result.missingKeywords.length).toBe(0);
    });
  });
});
