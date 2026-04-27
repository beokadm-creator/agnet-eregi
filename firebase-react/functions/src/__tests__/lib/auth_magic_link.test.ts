import { createMagicLink } from "../../lib/auth_magic_link";

describe("auth_magic_link", () => {
  let mockSet: jest.Mock;
  let mockDoc: jest.Mock;
  let mockCollection: jest.Mock;
  let mockAdminApp: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSet = jest.fn();
    mockDoc = jest.fn(() => ({
      set: mockSet
    }));
    mockCollection = jest.fn(() => ({
      doc: mockDoc
    }));

    mockAdminApp = {
      firestore: jest.fn(() => ({
        collection: mockCollection
      }))
    };
    
    // Inject FieldValue and Timestamp mocks
    mockAdminApp.firestore.FieldValue = {
      serverTimestamp: jest.fn(() => "MOCK_TIMESTAMP")
    };
    mockAdminApp.firestore.Timestamp = {
      fromDate: jest.fn((date) => `MOCK_TIMESTAMP_${date.getTime()}`)
    };
  });

  describe("createMagicLink", () => {
    it("should create a magic link and store it in firestore", async () => {
      const originalEnv = process.env.API_BASE_URL;
      process.env.API_BASE_URL = "https://test-api.com";

      const targetUid = "user_123";
      const redirectUrl = "https://app.com/dashboard";

      const link = await createMagicLink(mockAdminApp, targetUid, redirectUrl);

      // Verify the link format
      expect(link).toMatch(/^https:\/\/test-api\.com\/v1\/auth\/magic-link\?token=[a-f0-9]{64}$/);

      // Extract the generated token from the link
      const token = link.split("token=")[1];

      // Verify Firestore interactions
      expect(mockCollection).toHaveBeenCalledWith("magic_links");
      expect(mockDoc).toHaveBeenCalledWith(token);
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        targetUid,
        redirectUrl,
        used: false,
        createdAt: "MOCK_TIMESTAMP",
        expiresAt: expect.stringMatching(/^MOCK_TIMESTAMP_/)
      }));

      process.env.API_BASE_URL = originalEnv;
    });

    it("should fallback to default API_BASE_URL if not set", async () => {
      const originalEnv = process.env.API_BASE_URL;
      delete process.env.API_BASE_URL;

      const link = await createMagicLink(mockAdminApp, "user_123", "url");
      expect(link).toMatch(/^https:\/\/api\.agentregi\.com\/v1\/auth\/magic-link\?token=[a-f0-9]{64}$/);

      process.env.API_BASE_URL = originalEnv;
    });
  });
});
