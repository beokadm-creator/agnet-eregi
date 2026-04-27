import { doResolve, doResolveAction } from "../../lib/ops_actions";

describe("ops_actions.doResolve", () => {
  it("should resolve basic fields correctly", () => {
    const rawFields = [
      {
        id: "FIELD_STATUS",
        name: "Status",
        options: [
          { id: "OPT_TODO", name: "To Do" },
          { id: "OPT_IN_PROGRESS", name: "In Progress" },
          { id: "OPT_DONE", name: "Done" }
        ]
      },
      {
        id: "FIELD_PRIORITY",
        name: "Priority",
        options: [
          { id: "OPT_P0", name: "P0" },
          { id: "OPT_P1", name: "P1" },
          { id: "OPT_P2", name: "P2" }
        ]
      }
    ];

    const customAliases = {};

    const { resolved, missingMappings } = doResolve(rawFields, customAliases);

    expect(resolved.statusFieldId).toBe("FIELD_STATUS");
    expect(resolved.statusOptionIds.todo).toBe("OPT_TODO");
    expect(resolved.statusOptionIds.in_progress).toBe("OPT_IN_PROGRESS");
    expect(resolved.statusOptionIds.done).toBe("OPT_DONE");

    expect(resolved.priorityFieldId).toBe("FIELD_PRIORITY");
    expect(resolved.priorityOptionIds.p0).toBe("OPT_P0");
    expect(resolved.priorityOptionIds.p1).toBe("OPT_P1");
    expect(resolved.priorityOptionIds.p2).toBe("OPT_P2");

    expect(missingMappings).not.toContain("statusFieldId");
    expect(missingMappings).not.toContain("priorityFieldId");
  });

  it("should apply customAliases correctly", () => {
    const rawFields = [
      {
        id: "FIELD_MY_STATUS",
        name: "My State",
        options: [
          { id: "OPT_NEW", name: "대기상태" }
        ]
      }
    ];

    const customAliases = {
      fieldAliases: {
        status: ["My State"]
      },
      optionAliases: {
        "status.todo": ["대기상태"]
      }
    };

    const { resolved, missingMappings } = doResolve(rawFields, customAliases);

    expect(resolved.statusFieldId).toBe("FIELD_MY_STATUS");
    expect(resolved.statusOptionIds.todo).toBe("OPT_NEW");

    expect(missingMappings).toContain("priorityFieldId"); // Because priority is missing
    expect(missingMappings).toContain("severityFieldId");
  });

  it("should ignore case and spaces when matching aliases", () => {
    const rawFields = [
      {
        id: "FIELD_STATE",
        name: "s T a t e ",
        options: [
          { id: "OPT_TODO", name: "T o D o " }
        ]
      }
    ];

    const { resolved } = doResolve(rawFields, {});
    expect(resolved.statusFieldId).toBe("FIELD_STATE");
    expect(resolved.statusOptionIds.todo).toBe("OPT_TODO");
  });
});

describe("ops_actions.doResolveAction", () => {
  it("should update firestore with resolved fields", async () => {
    const mockUpdate = jest.fn().mockResolvedValue(true);
    const mockGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        rawFields: [
          {
            id: "FIELD_STATE",
            name: "Status",
            options: [{ id: "OPT_TODO", name: "To Do" }]
          }
        ],
        customAliases: {}
      })
    });

    const mockDoc = jest.fn(() => ({
      get: mockGet,
      update: mockUpdate
    }));

    const mockCollection = jest.fn(() => ({
      doc: mockDoc
    }));

    const mockAdminApp = {
      firestore: () => {
        const db = { collection: mockCollection };
        return db;
      }
    } as any;
    
    mockAdminApp.firestore.FieldValue = {
      serverTimestamp: () => "MOCK_TIMESTAMP"
    };

    const result = await doResolveAction(mockAdminApp, "pilot-gate", "test-uid");

    expect(result.resolved.statusFieldId).toBe("FIELD_STATE");
    expect(result.resolved.statusOptionIds.todo).toBe("OPT_TODO");
    
    expect(mockCollection).toHaveBeenCalledWith("ops_github_project_config");
    expect(mockDoc).toHaveBeenCalledWith("pilot-gate");
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      resolved: expect.any(Object),
      missingMappings: expect.any(Array),
      updatedAt: "MOCK_TIMESTAMP",
      updatedBy: "test-uid"
    }));
  });

  it("should throw error if config not exists", async () => {
    const mockGet = jest.fn().mockResolvedValue({ exists: false });
    const mockDoc = jest.fn(() => ({ get: mockGet }));
    const mockCollection = jest.fn(() => ({ doc: mockDoc }));

    const mockAdminApp = {
      firestore: () => ({ collection: mockCollection })
    } as any;

    await expect(doResolveAction(mockAdminApp, "invalid-gate", "test-uid"))
      .rejects
      .toThrow("Project 설정이 없습니다. 먼저 Discover API를 실행하세요.");
  });

  it("should throw error if rawFields not exists", async () => {
    const mockGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({}) // missing rawFields
    });
    const mockDoc = jest.fn(() => ({ get: mockGet }));
    const mockCollection = jest.fn(() => ({ doc: mockDoc }));

    const mockAdminApp = {
      firestore: () => ({ collection: mockCollection })
    } as any;

    await expect(doResolveAction(mockAdminApp, "invalid-gate", "test-uid"))
      .rejects
      .toThrow("rawFields가 없습니다. Discover를 다시 실행하세요.");
  });
});
