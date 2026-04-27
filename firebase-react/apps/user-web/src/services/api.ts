export class ApiService {
  constructor(private getToken: () => string) {}

  private get headers() {
    return {
      Authorization: `Bearer ${this.getToken()}`,
      "Content-Type": "application/json",
      "X-Firebase-AppCheck": "demo-app-check-token"
    };
  }

  async get(path: string) {
    const res = await fetch(path, { headers: this.headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }

  async post(path: string, body: any) {
    const res = await fetch(path, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }

  async put(path: string, body: any) {
    const res = await fetch(path, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }

  async delete(path: string) {
    const res = await fetch(path, {
      method: "DELETE",
      headers: this.headers
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || "API Error");
    return data.data;
  }
}

// 싱글톤 인스턴스 생성을 위해 토큰 게터(getter)를 외부에서 주입할 수 있도록 헬퍼 함수 제공
let apiInstance: ApiService | null = null;

export const initApi = (getToken: () => string) => {
  apiInstance = new ApiService(getToken);
};

export const getApi = () => {
  if (!apiInstance) throw new Error("API not initialized. Call initApi first.");
  return apiInstance;
};