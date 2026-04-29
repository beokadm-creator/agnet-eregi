import { getApiBaseUrl } from "../apiBase";

export class ApiService {
  public actingPartnerId: string = "";

  constructor(private getToken: () => string) {}

  private get headers() {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.getToken()}`,
      "Content-Type": "application/json"
    };
    if (this.actingPartnerId) {
      h["X-Partner-Id"] = this.actingPartnerId;
    }
    return h;
  }

  private getBaseUrl() {
    return getApiBaseUrl();
  }

  async get(path: string) {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.getToken()}` };
    if (this.actingPartnerId) headers["X-Partner-Id"] = this.actingPartnerId;
    const res = await fetch(`${this.getBaseUrl()}${path}`, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }

  async post(path: string, body: any) {
    const res = await fetch(`${this.getBaseUrl()}${path}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }

  async put(path: string, body: any) {
    const res = await fetch(`${this.getBaseUrl()}${path}`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }

  async patch(path: string, body: any) {
    const res = await fetch(`${this.getBaseUrl()}${path}`, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }

  async delete(path: string) {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.getToken()}` };
    if (this.actingPartnerId) headers["X-Partner-Id"] = this.actingPartnerId;
    const res = await fetch(`${this.getBaseUrl()}${path}`, {
      method: "DELETE",
      headers
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }
}

let apiInstance: ApiService | null = null;

export const initApi = (getToken: () => string) => {
  apiInstance = new ApiService(getToken);
};

export const getApi = () => {
  if (!apiInstance) throw new Error("API not initialized. Call initApi first.");
  return apiInstance;
};
