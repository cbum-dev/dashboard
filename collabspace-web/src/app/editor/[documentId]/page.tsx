"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import {
  type DocumentVersion,
  getDocumentVersions,
  createDocumentVersion,
  restoreDocumentVersion,
} from "@/lib/api";

const COLLAB_WS_URL =
  process.env.NEXT_PUBLIC_COLLAB_WS_URL ?? "ws://localhost:1234";

function randomColor() {
  const colors = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
  return colors[Math.floor(Math.random() * colors.length)]!;
}

function getLocalUser() {
  if (typeof window === "undefined") {
    return { name: "Guest", color: "#3b82f6" };
  }
  const storedName = window.localStorage.getItem("collabspace:userName");
  const storedColor = window.localStorage.getItem("collabspace:userColor");
  const name = storedName || `User-${Math.floor(Math.random() * 1000)}`;
  const color = storedColor || randomColor();
  if (!storedName) window.localStorage.setItem("collabspace:userName", name);
  if (!storedColor) window.localStorage.setItem("collabspace:userColor", color);
  return { name, color };
}

export default function DocumentEditorPage() {
  const router = useRouter();
  const params = useParams<{ documentId: string }>();
  const documentId = Array.isArray(params.documentId)
    ? params.documentId[0]
    : params.documentId;
  const user = useMemo(() => getLocalUser(), []);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const autoSnapshotStartedRef = useRef(false);
  const dirtySinceLastSnapshotRef = useRef(false);
  const autoSnapshotIntervalRef = useRef<number | null>(null);

  const ydoc = useMemo(() => new Y.Doc(), []);
  const wsProvider = useMemo(
    () =>
      new WebsocketProvider(
        COLLAB_WS_URL,
        `document-${documentId}`,
        ydoc
      ),
    [documentId, ydoc]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({ provider: wsProvider, user }),
    ],
    autofocus: true,
  });

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("accessToken")
        : null;
    if (!token) {
      router.replace("/login");
      return;
    }
    setAccessToken(token);
    const tokenString = token;
    async function loadVersions() {
      try {
        const list = await getDocumentVersions(tokenString, documentId);
        setVersions(list);
      } finally {
        setLoadingVersions(false);
      }
    }
    loadVersions();
  }, [documentId, router]);
  useEffect(() => {
    if (!editor || !accessToken) return;

    async function saveAutoSnapshot() {
      if (!editor || !accessToken) return;
      const json = editor.getJSON();
      const content = JSON.stringify(json);
      await createDocumentVersion(accessToken, documentId, {
        title: "Auto snapshot",
        content,
        type: "AUTO",
      });
      const list = await getDocumentVersions(accessToken, documentId);
      setVersions(list);
    }

    function markDirty() {
      dirtySinceLastSnapshotRef.current = true;
      if (!autoSnapshotStartedRef.current) {
        autoSnapshotStartedRef.current = true;
        void saveAutoSnapshot();
        const id = window.setInterval(async () => {
          if (!dirtySinceLastSnapshotRef.current) return;
          dirtySinceLastSnapshotRef.current = false;
          await saveAutoSnapshot();
        }, 2 * 60 * 1000);
        autoSnapshotIntervalRef.current = id;
      }
    }

    editor.on("update", markDirty);

    return () => {
      editor.off("update", markDirty);
      if (autoSnapshotIntervalRef.current !== null) {
        window.clearInterval(autoSnapshotIntervalRef.current);
        autoSnapshotIntervalRef.current = null;
        autoSnapshotStartedRef.current = false;
      }
    };
  }, [editor, accessToken, documentId]);

  async function saveSnapshot(type: "AUTO" | "MANUAL", title: string) {
    if (!accessToken || !editor) return;
    const json = editor.getJSON();
    const content = JSON.stringify(json);
    await createDocumentVersion(accessToken, documentId, {
      title,
      content,
      type,
    });
    const list = await getDocumentVersions(accessToken, documentId);
    setVersions(list);
  }

  async function handleManualSnapshot() {
    setSavingSnapshot(true);
    try {
      await saveSnapshot("MANUAL", "Manual snapshot");
    } finally {
      setSavingSnapshot(false);
    }
  }

  async function handleRestore(version: DocumentVersion) {
    if (!accessToken || !editor) return;
    await restoreDocumentVersion(accessToken, documentId, version.id);
    try {
      const json = JSON.parse(version.content);
      editor.commands.setContent(json);
      editor.commands.focus();
    } catch {
      // ignore invalid snapshot content
    }
    const list = await getDocumentVersions(accessToken, documentId);
    setVersions(list);
  }

  if (!editor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-600">Loading editor…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 text-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xs text-zinc-500 hover:text-zinc-800"
          >
            ← Back
          </button>
          <h1 className="text-sm font-semibold">Document editor</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-700">
          <span
            className="inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: user.color }}
          />
          <span>{user.name}</span>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl gap-4 px-6 py-6">
        <section className="flex-1 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <EditorContent editor={editor} className="prose max-w-none" />
        </section>
        <aside className="w-64 rounded-xl border border-zinc-200 bg-white p-4 text-xs shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Versions
            </h2>
            <button
              onClick={handleManualSnapshot}
              disabled={savingSnapshot || !accessToken}
              className="rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {savingSnapshot ? "Saving…" : "Snapshot"}
            </button>
          </div>
          {loadingVersions ? (
            <p className="text-[11px] text-zinc-500">Loading versions…</p>
          ) : versions.length === 0 ? (
            <p className="text-[11px] text-zinc-500">No versions yet.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-auto">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-col gap-1 rounded-md border border-zinc-200 px-2 py-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium">{v.title}</span>
                    <span className="text-[10px] uppercase text-zinc-500">
                      {v.snapshotType}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(v.createdAt).toLocaleString()} – {v.author.name}
                  </span>
                  <button
                    onClick={() => handleRestore(v)}
                    className="mt-1 self-start rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-zinc-800"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
    </div>
  );
}
