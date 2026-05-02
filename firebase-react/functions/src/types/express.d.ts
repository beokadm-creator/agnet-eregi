import * as admin from "firebase-admin";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: {
        uid: string;
        email?: string;
        partnerId?: string | null;
        isOps: boolean;
        opsRole?: string;
        [key: string]: unknown;
      };
      rawBody?: Buffer;
    }
  }
}
