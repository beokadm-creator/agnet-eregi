import { useState, useCallback, useEffect } from "react";
import { apiGet, apiPost } from "../api";

export function useCaseDetail(caseId: string | null) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [caseDetail, setCaseDetail] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [workflow, setWorkflow] = useState<any | null>(null);
  const [casePack, setCasePack] = useState<any | null>(null);
  const [requiredSlots, setRequiredSlots] = useState<string[]>([]);
  const [caseTasks, setCaseTasks] = useState<any[]>([]);
  const [filing, setFiling] = useState<any | null>(null);
  const [form, setForm] = useState<any | null>(null);

  const load = useCallback(async () => {
    if (!caseId) {
      setCaseDetail(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const [
        cRes, tRes, dRes, qRes, wRes, tasksRes, fRes, formRes
      ] = await Promise.allSettled([
        apiGet(`/v1/cases/${caseId}`),
        apiGet(`/v1/cases/${caseId}/timeline?limit=50`),
        apiGet(`/v1/cases/${caseId}/documents`),
        apiGet(`/v1/cases/${caseId}/quotes`),
        apiGet(`/v1/cases/${caseId}/workflow`),
        apiGet(`/v1/cases/${caseId}/tasks`),
        apiGet(`/v1/cases/${caseId}/filing`),
        apiGet(`/v1/cases/${caseId}/forms/officer-change`)
      ]);

      if (cRes.status === "fulfilled") setCaseDetail(cRes.value.case);
      if (tRes.status === "fulfilled") setTimeline(tRes.value.items || []);
      if (dRes.status === "fulfilled") setDocuments(dRes.value.items || []);
      if (qRes.status === "fulfilled") setQuotes(qRes.value.items || []);
      if (wRes.status === "fulfilled") {
        setWorkflow({ ...(wRes.value.workflow || null), _advance: wRes.value.advance || null });
        setCasePack(wRes.value.casePack || null);
        setRequiredSlots(wRes.value.requiredSlots || []);
      }
      if (tasksRes.status === "fulfilled") setCaseTasks(tasksRes.value.items || []);
      if (fRes.status === "fulfilled") setFiling(fRes.value.filing || null);
      if (formRes.status === "fulfilled") setForm(formRes.value.form || null);

      // Check if any critical request failed
      if (cRes.status === "rejected") throw new Error(cRes.reason);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const advanceStage = async () => {
    if (!caseId) return;
    setBusy(true);
    try {
      await apiPost(`/v1/cases/${caseId}/workflow/advance`, {});
      await load();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const completeTask = async (taskId: string) => {
    if (!caseId) return;
    setBusy(true);
    try {
      await apiPost(`/v1/cases/${caseId}/tasks/${taskId}/complete`, {});
      await load();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const setChecklist = async (itemId: string, done: boolean) => {
    if (!caseId) return;
    setBusy(true);
    try {
      await apiPost(`/v1/cases/${caseId}/workflow/checklist`, { itemId, done });
      await load();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    error,
    caseDetail,
    timeline,
    documents,
    quotes,
    workflow,
    casePack,
    requiredSlots,
    caseTasks,
    filing,
    form,
    load,
    advanceStage,
    completeTask,
    setChecklist
  };
}
