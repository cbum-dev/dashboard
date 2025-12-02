"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMe,
  type AuthUser,
  type Workspace,
  type DocumentSummary,
  getWorkspaces,
  createWorkspace,
  getDocuments,
  createDocument,
} from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [creatingDocument, setCreatingDocument] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newDocumentTitle, setNewDocumentTitle] = useState("");

  useEffect(() => {
    async function load() {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("accessToken")
          : null;
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        const me = await fetchMe(token);
        if (!me) {
          router.replace("/login");
          return;
        }
        setUser(me);
        setAccessToken(token);
        const ws = await getWorkspaces(token);
        setWorkspaces(ws);
        if (ws.length > 0) {
          setSelectedWorkspaceId(ws[0]!.id);
          const docs = await getDocuments(token, ws[0]!.id);
          setDocuments(docs);
        }
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("accessToken");
      window.localStorage.removeItem("refreshToken");
    }
    router.replace("/login");
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !newWorkspaceName.trim()) return;
    setCreatingWorkspace(true);
    try {
      const ws = await createWorkspace(accessToken, { name: newWorkspaceName.trim() });
      setWorkspaces((prev) => [...prev, ws]);
      setNewWorkspaceName("");
      setSelectedWorkspaceId(ws.id);
      setDocuments([]);
    } finally {
      setCreatingWorkspace(false);
    }
  }

  async function handleSelectWorkspace(id: string) {
    if (!accessToken) return;
    setSelectedWorkspaceId(id);
    const docs = await getDocuments(accessToken, id);
    setDocuments(docs);
  }

  async function handleCreateDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !selectedWorkspaceId || !newDocumentTitle.trim()) return;
    setCreatingDocument(true);
    try {
      const doc = await createDocument(accessToken, selectedWorkspaceId, {
        title: newDocumentTitle.trim(),
      });
      setDocuments((prev) => [...prev, doc]);
      setNewDocumentTitle("");
    } finally {
      setCreatingDocument(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold">CollabSpace</h1>
        <div className="flex items-center gap-3 text-sm text-zinc-700">
          {user && <span>{user.name}</span>}
          <button
            onClick={handleLogout}
            className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl gap-6 px-6 py-8">
        <aside className="w-64 rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Workspaces</h2>
          <div className="space-y-2">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSelectWorkspace(ws.id)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs ${
                  ws.id === selectedWorkspaceId
                    ? "bg-zinc-900 text-white"
                    : "hover:bg-zinc-100"
                }`}
              >
                <span>{ws.name}</span>
                <span className="uppercase text-[10px] opacity-70">{ws.role}</span>
              </button>
            ))}
          </div>
          <form onSubmit={handleCreateWorkspace} className="mt-4 space-y-2">
            <input
              type="text"
              placeholder="New workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-900"
            />
            <button
              type="submit"
              disabled={creatingWorkspace}
              className="w-full rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {creatingWorkspace ? "Creating..." : "Create workspace"}
            </button>
          </form>
        </aside>
        <section className="flex-1 rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Documents</h2>
          {selectedWorkspaceId ? (
            <>
              <div className="mb-3 space-y-2">
                {documents.length === 0 ? (
                  <p className="text-xs text-zinc-500">No documents yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2"
                      >
                        <span className="text-xs font-medium">{doc.title}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/editor/${doc.id}`)}
                            className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-zinc-800"
                          >
                            Open editor
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <form onSubmit={handleCreateDocument} className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="New document title"
                  value={newDocumentTitle}
                  onChange={(e) => setNewDocumentTitle(e.target.value)}
                  className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-900"
                />
                <button
                  type="submit"
                  disabled={creatingDocument}
                  className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {creatingDocument ? "Creating..." : "Create"}
                </button>
              </form>
            </>
          ) : (
            <p className="text-xs text-zinc-500">Create a workspace to start.</p>
          )}
        </section>
      </main>
    </div>
  );
}
