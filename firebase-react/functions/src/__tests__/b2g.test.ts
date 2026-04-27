import request from "supertest";
import express from "express";
import * as admin from "firebase-admin";
import { registerUserSubmissionRoutes } from "../routes/v1/user_submissions";

// Firebase Admin 모킹
jest.mock("firebase-admin", () => {
  const mockUserSubmissionDoc = (id: string) => {
    if (id === "valid-sub") {
      return {
        id: "valid-sub",
        exists: true,
        data: () => ({ userId: "test-user-uid", caseId: "test-case-id" }),
      };
    } else if (id === "no-case-sub") {
      return {
        id: "no-case-sub",
        exists: true,
        data: () => ({ userId: "test-user-uid" }), // caseId 없음
      };
    } else if (id === "other-user-sub") {
      return {
        id: "other-user-sub",
        exists: true,
        data: () => ({ userId: "other-uid", caseId: "test-case-id" }),
      };
    }
    return { id, exists: false, data: () => undefined };
  };

  const mockB2gSubmissionsGet = jest.fn().mockResolvedValue({
    docs: [
      {
        id: "b2g-item-1",
        data: () => ({ status: "submitted", createdAt: { toMillis: () => 1000 } }),
      },
    ],
  });

  const mockB2gFeesGet = jest.fn().mockResolvedValue({
    docs: [
      {
        id: "fee-item-1",
        data: () => ({ amount: 50000, createdAt: { toMillis: () => 2000 } }),
      },
    ],
  });

  const mockCollection = (path: string) => {
    if (path === "user_submissions") {
      return {
        doc: jest.fn((id) => ({
          get: jest.fn().mockResolvedValue(mockUserSubmissionDoc(id)),
        })),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [] }),
      };
    } else if (path === "b2g_submissions") {
      return {
        where: jest.fn().mockReturnValue({
          get: mockB2gSubmissionsGet,
        }),
      };
    } else if (path === "b2g_fee_payments") {
      return {
        where: jest.fn().mockReturnValue({
          get: mockB2gFeesGet,
        }),
      };
    }
    return {
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: false }),
      })),
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    };
  };

  const firestoreMock = jest.fn(() => ({
    collection: jest.fn(mockCollection),
  })) as any;

  firestoreMock.FieldValue = {
    serverTimestamp: jest.fn(() => "mock-timestamp"),
  };

  return {
    firestore: firestoreMock,
    app: {
      App: class {},
    },
    storage: jest.fn(() => ({
      bucket: jest.fn(() => ({
        file: jest.fn(() => ({
          exists: jest.fn().mockResolvedValue([true]),
          getSignedUrl: jest.fn().mockResolvedValue(["http://mock-url"]),
        })),
      })),
    })),
  };
});

// requireAuth 미들웨어 모킹
jest.mock("../lib/auth", () => {
  return {
    requireAuth: jest.fn().mockImplementation(async (adminApp, req, res) => {
      // 테스트 목적: 'Bearer invalid' 헤더가 오면 실패 처리
      if (req.headers.authorization === "Bearer invalid") {
        res.status(401).json({ ok: false, error: { code: "UNAUTHENTICATED", messageKo: "인증 실패" } });
        return null;
      }
      // 기본적으로 'test-user-uid' 로 인증된 것으로 취급
      return { uid: "test-user-uid" };
    }),
    partnerIdOf: jest.fn().mockReturnValue("test-partner-1"),
    isOps: jest.fn().mockReturnValue(false),
    requireOpsRole: jest.fn().mockReturnValue(true)
  };
});

// 에러 로그로 인한 테스트 콘솔 오염 방지를 위해 logError 모킹
jest.mock("../lib/ops_audit", () => {
  const original = jest.requireActual("../lib/ops_audit");
  return {
    ...original,
    logError: jest.fn(),
  };
});

describe("GET /v1/user/submissions/:id/b2g", () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // 라우터 등록
    registerUserSubmissionRoutes(app, admin as any);
  });

  it("성공적으로 B2G 항목과 수수료 정보를 가져와야 한다", async () => {
    const res = await request(app)
      .get("/v1/user/submissions/valid-sub/b2g")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].id).toBe("b2g-item-1");
    expect(res.body.data.fees).toHaveLength(1);
    expect(res.body.data.fees[0].id).toBe("fee-item-1");
  });

  it("caseId가 없는 제출 내역의 경우 빈 배열을 반환해야 한다", async () => {
    const res = await request(app)
      .get("/v1/user/submissions/no-case-sub/b2g")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.fees).toEqual([]);
  });

  it("존재하지 않는 제출 내역일 경우 404를 반환해야 한다", async () => {
    const res = await request(app)
      .get("/v1/user/submissions/not-found/b2g")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.messageKo).toBe("제출 내역을 찾을 수 없습니다.");
  });

  it("다른 사용자의 제출 내역에 접근 시 404를 반환해야 한다", async () => {
    const res = await request(app)
      .get("/v1/user/submissions/other-user-sub/b2g")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.messageKo).toBe("제출 내역을 찾을 수 없습니다.");
  });

  it("인증되지 않은 요청일 경우 401을 반환해야 한다", async () => {
    const res = await request(app)
      .get("/v1/user/submissions/valid-sub/b2g")
      .set("Authorization", "Bearer invalid");

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});