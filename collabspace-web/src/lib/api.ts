const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = (await res.json()) as any;
      if (data?.error) message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
  avatarUrl?: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchMe(accessToken: string): Promise<AuthUser | null> {
  return request<AuthUser | null>("/auth/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export type Workspace = {
  id: string;
  name: string;
  role: string;
};

export type DocumentSummary = {
  id: string;
  title: string;
  workspaceId: string;
  ownerId: string;
};

export type WorkspaceMember = {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
};

export type DocumentVersion = {
  id: string;
  documentId: string;
  authorId: string;
  title: string;
  snapshotType: "AUTO" | "MANUAL";
  content: string;
  changesSummary?: string | null;
  changeCount?: number | null;
  createdAt: string;
  author: {
    id: string;
    email: string;
    name: string;
  };
};

export async function getWorkspaces(accessToken: string): Promise<Workspace[]> {
  return request<Workspace[]>("/workspaces", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function createWorkspace(accessToken: string, input: { name: string }): Promise<Workspace> {
  return request<Workspace>("/workspaces", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
}

export async function getWorkspaceMembers(
  accessToken: string,
  workspaceId: string
): Promise<WorkspaceMember[]> {
  return request<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function inviteWorkspaceMember(
  accessToken: string,
  workspaceId: string,
  input: { email: string }
): Promise<WorkspaceMember> {
  return request<WorkspaceMember>(`/workspaces/${workspaceId}/invite`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
}

export async function getDocuments(accessToken: string, workspaceId: string): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>(`/workspaces/${workspaceId}/documents`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function createDocument(
  accessToken: string,
  workspaceId: string,
  input: { title: string }
): Promise<DocumentSummary> {
  return request<DocumentSummary>(`/workspaces/${workspaceId}/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
}

export async function getDocumentVersions(
  accessToken: string,
  documentId: string
): Promise<DocumentVersion[]> {
  return request<DocumentVersion[]>(`/documents/${documentId}/versions`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function createDocumentVersion(
  accessToken: string,
  documentId: string,
  input: {
    title: string;
    content: string;
    changesSummary?: string;
    changeCount?: number;
    type?: "AUTO" | "MANUAL";
  }
): Promise<DocumentVersion> {
  return request<DocumentVersion>(`/documents/${documentId}/versions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
}

// In src/lib/api.ts, update the restoreDocumentVersion function
export async function restoreDocumentVersion(
  accessToken: string,
  documentId: string,
  versionId: string
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/documents/${documentId}/restore/${versionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}), 
  });
}