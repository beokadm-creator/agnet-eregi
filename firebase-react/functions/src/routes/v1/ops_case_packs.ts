import { Express } from "express";
import * as admin from "firebase-admin";
import { requireAuth } from "../../lib/auth";
import { requireOpsRole } from "../../lib/ops_rbac";
import { ok, fail, logError } from "../../lib/http";
import { logOpsEvent } from "../../lib/ops_audit";
import { CasePack } from "../../lib/case_pack_models";

export function registerOpsCasePackRoutes(app: Express, adminApp: typeof admin) {
  const db = adminApp.firestore();

  // 1. [운영자] 사건팩 생성 (POST /v1/ops/case-packs)
  app.post("/v1/ops/case-packs", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const auth = (req as any).user;
    const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin", "case_pack_mgmt");
    if (!hasRole) return;

    const { id, category, nameKo, active, formSchema, workflow } = req.body;

    if (!id || !nameKo) {
      return fail(res, 400, "INVALID_ARGUMENT", "id와 nameKo는 필수입니다.", { requestId });
    }

    try {
      const packRef = db.collection("case_packs").doc(id);
      const existing = await packRef.get();
      
      if (existing.exists) {
        return fail(res, 409, "ALREADY_EXISTS", "이미 존재하는 사건팩 ID입니다.", { requestId });
      }

      const newPack: CasePack = {
        id,
        category: category || "general",
        nameKo,
        active: active !== undefined ? active : false,
        formSchema: formSchema || { type: "object", properties: {} },
        workflow: workflow || { stages: [], requiredSlots: [], checklists: {} },
        createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      await packRef.set(newPack);

      await logOpsEvent(adminApp, {
        gateKey: "case_pack_mgmt",
        action: "CASE_PACK_CREATED",
        status: "success",
        actorUid: auth.uid,
        requestId,
        summary: "사건팩 생성됨",
        target: { id, nameKo, category }
      });

      return ok(res, { pack: newPack }, requestId);
    } catch (error: any) {
      logError("POST /v1/ops/case-packs", "N/A", "INTERNAL", "사건팩 생성 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "사건팩 생성에 실패했습니다.", { error: error.message, requestId });
    }
  });

  // 2. [운영자] 사건팩 수정 (PUT /v1/ops/case-packs/:id)
  app.put("/v1/ops/case-packs/:id", requireAuth, async (req, res) => {
    const requestId = (req as any).requestId || "req-unknown";
    const auth = (req as any).user;
    const hasRole = await requireOpsRole(adminApp, req, res, auth, "ops_admin", "case_pack_mgmt");
    if (!hasRole) return;

    const packId = String(req.params.id);
    const updates = req.body;

    // 보호할 필드 제거 (id, createdAt)
    delete updates.id;
    delete updates.createdAt;

    try {
      const packRef = db.collection("case_packs").doc(packId);
      const existing = await packRef.get();
      
      if (!existing.exists) {
        return fail(res, 404, "NOT_FOUND", "수정할 사건팩을 찾을 수 없습니다.", { requestId });
      }

      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      await packRef.update(updates);

      await logOpsEvent(adminApp, {
        gateKey: "case_pack_mgmt",
        action: "CASE_PACK_UPDATED",
        status: "success",
        actorUid: auth.uid,
        requestId,
        summary: "사건팩 수정됨",
        target: { id: packId, updatedFields: Object.keys(updates) }
      });

      const updatedDoc = await packRef.get();
      return ok(res, { pack: { id: updatedDoc.id, ...updatedDoc.data() } }, requestId);
    } catch (error: any) {
      logError(`PUT /v1/ops/case-packs/${packId}`, "N/A", "INTERNAL", "사건팩 수정 중 오류가 발생했습니다.", error, requestId);
      return fail(res, 500, "INTERNAL", "사건팩 수정에 실패했습니다.", { error: error.message, requestId });
    }
  });
}
