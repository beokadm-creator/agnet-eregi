import { isOps, partnerIdOf, requireAuth } from "../../lib/auth";

describe("auth", () => {
  describe("isOps", () => {
    it("should return true if OPS_ALLOW_ALL is set", () => {
      process.env.OPS_ALLOW_ALL = "1";
      expect(isOps({ uid: "user1" } as any)).toBe(true);
      delete process.env.OPS_ALLOW_ALL;
    });

    it("should return true for valid ops roles", () => {
      expect(isOps({ uid: "user1", opsRole: "ops_admin" } as any)).toBe(true);
      expect(isOps({ uid: "user1", opsRole: "ops_operator" } as any)).toBe(true);
      expect(isOps({ uid: "user1", opsRole: "ops_viewer" } as any)).toBe(true);
    });

    it("should return false for missing or invalid ops role", () => {
      expect(isOps({ uid: "user1" } as any)).toBe(false);
      expect(isOps({ uid: "user1", opsRole: "random_role" } as any)).toBe(false);
    });
  });

  describe("partnerIdOf", () => {
    it("should return partnerId if present", () => {
      expect(partnerIdOf({ uid: "user1", partnerId: "partner123" } as any)).toBe("partner123");
    });

    it("should return null if partnerId is missing", () => {
      expect(partnerIdOf({ uid: "user1" } as any)).toBeNull();
    });
  });

    describe("requireAuth", () => {
    let mockVerifyIdToken: jest.Mock;
    let mockVerifyAppCheckToken: jest.Mock;
    let mockReq: any;
    let mockRes: any;
    let mockAdminApp: any;

    beforeEach(() => {
      mockVerifyIdToken = jest.fn();
      mockVerifyAppCheckToken = jest.fn();
      
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        getHeader: jest.fn().mockReturnValue("test-request-id")
      };

      mockAdminApp = {
        auth: () => ({
          verifyIdToken: mockVerifyIdToken
        }),
        appCheck: () => ({
          verifyToken: mockVerifyAppCheckToken
        })
      };

      process.env.ENFORCE_APP_CHECK = "1";
    });

    afterEach(() => {
      delete process.env.ENFORCE_APP_CHECK;
    });

    it("should fail if App Check is enforced and missing", async () => {
      mockReq = {
        header: jest.fn().mockReturnValue(null),
        headers: {},
        requestId: "test-req-id"
      };

      mockRes.req = mockReq;

      await requireAuth(mockAdminApp, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ messageKo: "App Check 토큰이 필요합니다." })
      }));
    });

    it("should fail if App Check token is invalid", async () => {
      mockReq = {
        header: jest.fn().mockReturnValue("invalid_app_check"),
        headers: {},
        requestId: "test-req-id"
      };
      
      mockRes.req = mockReq;

      mockAdminApp.appCheck().verifyToken.mockRejectedValue(new Error("Invalid token"));

      await requireAuth(mockAdminApp, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ messageKo: "유효하지 않은 App Check 토큰입니다." })
      }));
    });

    it("should fail if Auth header is missing", async () => {
      mockReq = {
        header: jest.fn().mockReturnValue("valid_app_check"),
        headers: {},
        requestId: "test-req-id"
      };
      
      mockRes.req = mockReq;

      mockAdminApp.appCheck().verifyToken.mockResolvedValue(true);

      await requireAuth(mockAdminApp, mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ messageKo: "인증 토큰이 필요합니다." })
      }));
    });

    it("should attach user and return decoded token on success", async () => {
      mockReq = {
        header: jest.fn().mockReturnValue("valid_app_check"),
        headers: {
          authorization: "Bearer valid_token"
        }
      };
      
      mockAdminApp.appCheck().verifyToken.mockResolvedValue(true);
      const mockDecodedToken = { uid: "test-uid", opsRole: "ops_admin", partnerId: "partner1" };
      mockAdminApp.auth().verifyIdToken.mockResolvedValue(mockDecodedToken);

      const decoded = await requireAuth(mockAdminApp, mockReq, mockRes);

      expect(decoded).toEqual(mockDecodedToken);
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.uid).toBe("test-uid");
      expect(mockReq.user.isOps).toBe(true);
      expect(mockReq.user.partnerId).toBe("partner1");
    });
  });
});
