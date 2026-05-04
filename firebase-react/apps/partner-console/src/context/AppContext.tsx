import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@rp/firebase";
import { getApi, initApi } from "../services/api";

interface AppContextType {
  idToken: string;
  claims: Record<string, any> | null;
  authReady: boolean;
  accessDenied: boolean;
  isOpsAdmin: boolean;
  actingPartnerId: string;
  setActingPartnerId: (id: string) => void;
  logout: () => Promise<void>;
  log: string;
  setLog: (l: string) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  
  cases: any[];
  setCases: (c: any[]) => void;
  selectedCase: any | null;
  setSelectedCase: (c: any) => void;
  
  notificationSettings: any;
  setNotificationSettings: (s: any) => void;
  
  partnerProfile: any;
  setPartnerProfile: (p: any) => void;

  teamMembers: any[];
  setTeamMembers: (m: any[]) => void;

  b2gCredentials: any[];
  setB2gCredentials: (c: any[]) => void;

  adCampaigns: any[];
  setAdCampaigns: (c: any[]) => void;

  subscriptionPlans: any[];
  setSubscriptionPlans: (p: any[]) => void;

  subscription: any;
  setSubscription: (s: any) => void;

  settlements: any[];
  setSettlements: (s: any[]) => void;

  evidences: any[];
  setEvidences: (e: any[]) => void;

  packages: any[];
  setPackages: (p: any[]) => void;

  evidenceRequests: any[];
  setEvidenceRequests: (r: any[]) => void;

  refunds: any[];
  setRefunds: (r: any[]) => void;

  quotes: any[];
  setQuotes: (q: any[]) => void;

  b2gSubmissions: any[];
  setB2gSubmissions: (s: any[]) => void;

  b2gFees: Record<string, any[]>;
  setB2gFees: (f: Record<string, any[]>) => void;

  expandedEvidenceId: string | null;
  setExpandedEvidenceId: (id: string | null) => void;

  pollError: string | null;
  setPollError: (e: string | null) => void;

  lastPolledAt: Date | null;
  setLastPolledAt: (d: Date | null) => void;

  loadCases: () => Promise<void>;
  loadCaseDetail: (caseId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const tokenRef = useRef("");
  const [idToken, setIdToken] = useState("");
  const [claims, setClaims] = useState<Record<string, any> | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isOpsAdmin, setIsOpsAdmin] = useState(false);
  const [actingPartnerId, setActingPartnerId] = useState<string>("");
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);
  
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  
  const [notificationSettings, setNotificationSettings] = useState<any>(null);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [b2gCredentials, setB2gCredentials] = useState<any[]>([]);
  const [adCampaigns, setAdCampaigns] = useState<any[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  
  const [evidences, setEvidences] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [evidenceRequests, setEvidenceRequests] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [b2gSubmissions, setB2gSubmissions] = useState<any[]>([]);
  const [b2gFees, setB2gFees] = useState<Record<string, any[]>>({});
  
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [lastPolledAt, setLastPolledAt] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setAuthReady(true);
      if (!u) {
        tokenRef.current = "";
        setIdToken("");
        setClaims(null);
        setAccessDenied(false);
        return;
      }
      const nextToken = await u.getIdToken(true);
      tokenRef.current = nextToken;
      setIdToken(nextToken);
      const tokenResult = await u.getIdTokenResult();
      setClaims(tokenResult.claims as any);
      const hasPartnerId = !!tokenResult.claims?.partnerId;
      const hasOpsAdmin = tokenResult.claims?.opsRole === "ops_admin";
      setIsOpsAdmin(hasOpsAdmin);
      setAccessDenied(!hasPartnerId && !hasOpsAdmin);
      initApi(() => tokenRef.current);
    });
    return () => unsubscribe();
  }, []);

  async function logout() {
    await signOut(auth);
  }

  async function loadCases() {
    try {
      const api = getApi();
      api.actingPartnerId = actingPartnerId || (claims?.partnerId ? String(claims.partnerId) : "");
      setBusy(true);
      setLog("케이스 및 설정 불러오는 중...");
      
      const res = await api.get("/v1/partner/cases");
      setCases(res.items || []);
      
      const notifyRes = await api.get("/v1/partner/notification-settings");
      setNotificationSettings(notifyRes.settings);
      
      const pId = actingPartnerId || (claims?.partnerId ? String(claims.partnerId) : "");
      if (pId) {
        const stRes = await api.get(`/v1/partners/${pId}/settlements`);
        setSettlements(stRes.settlements || []);
      }

      try {
        const adRes = await api.get("/v1/partner/ads/campaigns");
        setAdCampaigns(adRes.campaigns || []);
      } catch(e) { console.warn("[AppContext] Non-critical load failed:", e instanceof Error ? e.message : String(e)); }

      try {
        const subPlanRes = await api.get("/v1/subscriptions/plans");
        setSubscriptionPlans(subPlanRes.plans || []);
        const subRes = await api.get("/v1/partner/subscription");
        setSubscription(subRes.subscription || null);
      } catch(e) { console.warn("[AppContext] Non-critical load failed:", e instanceof Error ? e.message : String(e)); }

      try {
        const profileRes = await api.get("/v1/partner/profile");
        setPartnerProfile(profileRes.profile || null);
      } catch(e) { console.warn("[AppContext] Non-critical load failed:", e instanceof Error ? e.message : String(e)); }

      try {
        const b2gRes = await api.get("/v1/partners/credentials");
        setB2gCredentials(b2gRes.items || []);
      } catch(e) {
        setB2gCredentials([]);
      }

      try {
        const tmRes = await api.get("/v1/partner/team/members");
        setTeamMembers(tmRes.members || []);
      } catch(e) { console.warn("[AppContext] Non-critical load failed:", e instanceof Error ? e.message : String(e)); }

      setLog("데이터 갱신됨.");
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadCaseDetail(caseId: string) {
    if (!caseId) return;
    const api = getApi();
    api.actingPartnerId = actingPartnerId || (claims?.partnerId ? String(claims.partnerId) : "");
    setBusy(true);
    setPollError(null);
    setLog(`케이스 상세 정보 불러오는 중...`);
    try {
      const caseRes = await api.get(`/v1/partner/cases/${caseId}`);
      setSelectedCase(caseRes.case);
      
      const evRes = await api.get(`/v1/partner/cases/${caseId}/evidences`);
      setEvidences(evRes.items || []);
      
      const pkgRes = await api.get(`/v1/partner/cases/${caseId}/packages`);
      setPackages(pkgRes.items || []);
      
      const reqRes = await api.get(`/v1/partner/cases/${caseId}/evidence-requests`);
      setEvidenceRequests(reqRes.items || []);

      try {
        const refRes = await api.get(`/v1/partner/cases/${caseId}/refunds`);
        setRefunds(refRes.items || []);
      } catch(e) { console.warn("[AppContext] Refunds load failed:", e instanceof Error ? e.message : String(e)); setRefunds([]); }

      try {
        const qRes = await api.get(`/v1/cases/${caseId}/quotes`);
        setQuotes(qRes.quotes || []);
      } catch(e) { console.warn("[AppContext] Quotes load failed:", e instanceof Error ? e.message : String(e)); setQuotes([]); }

      try {
        const b2gRes = await api.get(`/v1/b2g/submissions?caseId=${caseId}`);
        setB2gSubmissions(b2gRes.items || []);
        
        const feeMap: Record<string, any[]> = {};
        for (const sub of (b2gRes.items || [])) {
          try {
            const feeRes = await api.get(`/v1/b2g/submissions/${sub.id}/fees`);
            feeMap[sub.id] = feeRes.items || [];
          } catch(e) { console.warn("[AppContext] Non-critical load failed:", e instanceof Error ? e.message : String(e)); }
        }
        setB2gFees(feeMap);
      } catch(e) {
        setB2gSubmissions([]);
        setB2gFees({});
      }

      setLog("상세 정보 불러오기 완료.");
    } catch (e: any) {
      setLog(`[Error] ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppContext.Provider value={{
      idToken, claims, authReady, accessDenied, logout, log, setLog, busy, setBusy,
      isOpsAdmin, actingPartnerId, setActingPartnerId,
      cases, setCases, selectedCase, setSelectedCase,
      notificationSettings, setNotificationSettings,
      partnerProfile, setPartnerProfile, teamMembers, setTeamMembers,
      b2gCredentials, setB2gCredentials, adCampaigns, setAdCampaigns,
      subscriptionPlans, setSubscriptionPlans, subscription, setSubscription,
      settlements, setSettlements,
      evidences, setEvidences, packages, setPackages,
      evidenceRequests, setEvidenceRequests, refunds, setRefunds,
      quotes, setQuotes, b2gSubmissions, setB2gSubmissions,
      b2gFees, setB2gFees,
      expandedEvidenceId, setExpandedEvidenceId,
      pollError, setPollError, lastPolledAt, setLastPolledAt,
      loadCases, loadCaseDetail
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
