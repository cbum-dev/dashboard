"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import {
  type DocumentVersion,
  getDocumentVersions,
  createDocumentVersion,
  restoreDocumentVersion,
  fetchMe,
} from "@/lib/api";
import {
  diff_match_patch,
  DIFF_EQUAL,
  DIFF_DELETE,
  DIFF_INSERT,
  type Diff,
} from "diff-match-patch";

const COLLAB_WS_URL =
  process.env.NEXT_PUBLIC_COLLAB_WS_URL ?? "ws://localhost:1234";

const COLORS = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"] as const;

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getFallbackUser() {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)]!;
  return { name: "Guest", color };
}

const dmp = new diff_match_patch();

function jsonToPlainText(node?: JSONContent | null): string {
  if (!node) return "";
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }
  if (Array.isArray(node.content)) {
    return node.content
      .map((child) => jsonToPlainText(child))
      .join(node.type === "paragraph" ? "\n" : "");
  }
  return "";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br />");
}

function buildSideBySideDiff(baseText: string, targetText: string) {
  const diffs = dmp.diff_main(baseText, targetText);
  dmp.diff_cleanupSemantic(diffs);
  const leftParts: string[] = [];
  const rightParts: string[] = [];

  diffs.forEach((diff: Diff) => {
    const [type, text] = diff;
    const safe = escapeHtml(text);
    if (type === DIFF_EQUAL) {
      const span = `<span>${safe}</span>`;
      leftParts.push(span);
      rightParts.push(span);
    } else if (type === DIFF_DELETE) {
      leftParts.push(`<span class="bg-red-100 text-red-700 line-through">${safe}</span>`);
    } else if (type === DIFF_INSERT) {
      rightParts.push(`<span class="bg-green-100 text-green-700">${safe}</span>`);
    }
  });

  return {
    leftHtml: leftParts.join(""),
    rightHtml: rightParts.join(""),
  };
}

export default function DocumentEditorPage() {
  const router = useRouter();
  const params = useParams<{ documentId: string }>();
  const documentId = Array.isArray(params.documentId)
    ? params.documentId[0]
    : params.documentId;
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const autoSnapshotStartedRef = useRef(false);
  const dirtySinceLastSnapshotRef = useRef(false);
  const autoSnapshotIntervalRef = useRef<number | null>(null);
  const [compareTarget, setCompareTarget] = useState<DocumentVersion | null>(null);
  const [diffHtml, setDiffHtml] = useState<{ leftHtml: string; rightHtml: string } | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [cursorUser, setCursorUser] = useState<{ name: string; color: string }>(getFallbackUser());
  const [participants, setParticipants] = useState<
    { clientId: number; name: string; color: string }[]
  >([]);

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
      CollaborationCursor.configure({ provider: wsProvider, user: cursorUser }),
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
    async function loadUser() {
      try {
        const me = await fetchMe(tokenString);
        if (me) {
          setCursorUser({ name: me.name, color: colorForId(me.id) });
        }
      } catch {
        // ignore
      }
    }
    loadVersions();
    void loadUser();
  }, [documentId, router]);

  useEffect(() => {
    if (!wsProvider) return;
    wsProvider.awareness.setLocalStateField("user", cursorUser);
  }, [wsProvider, cursorUser]);

  useEffect(() => {
    if (!wsProvider) return;
    const awareness = wsProvider.awareness;
    const handleChange = () => {
      const states = Array.from(awareness.getStates().entries())
        .map(([clientId, state]) => {
          const awarenessUser = state?.user as { name?: string; color?: string } | undefined;
          if (!awarenessUser?.name) return null;
          return {
            clientId,
            name: awarenessUser.name,
            color: awarenessUser.color ?? "#3b82f6",
          };
        })
        .filter(Boolean) as { clientId: number; name: string; color: string }[];
      setParticipants(states);
    };
    awareness.on("change", handleChange);
    handleChange();
    return () => {
      awareness.off("change", handleChange);
    };
  }, [wsProvider]);

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

  async function handleCompare(version: DocumentVersion) {
    if (!editor) return;
    try {
      const versionJson = JSON.parse(version.content) as JSONContent;
      const versionText = jsonToPlainText(versionJson);
      const currentText = jsonToPlainText(editor.getJSON());
      const diff = buildSideBySideDiff(versionText, currentText);
      setCompareTarget(version);
      setDiffHtml(diff);
      setShowDiff(true);
    } catch {
      // ignore invalid content
    }
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
            style={{ backgroundColor: cursorUser.color }}
          />
          <span>{cursorUser.name}</span>
        </div>
      </header>
      <div className="border-b border-zinc-200 bg-white px-6 py-3 text-xs text-zinc-600">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-zinc-700">Currently collaborating:</span>
          {participants.length === 0 ? (
            <span>No one else is here yet.</span>
          ) : (
            participants.map((person) => (
              <span
                key={person.clientId}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-1"
              >
                <span
                  className="inline-flex h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: person.color }}
                />
                <span>{person.name}</span>
              </span>
            ))
          )}
        </div>
      </div>
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
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => handleCompare(v)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      Compare
                    </button>
                    <button
                      onClick={() => handleRestore(v)}
                      className="rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-zinc-800"
                    >
                      Restore
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
      {showDiff && compareTarget && diffHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Comparing snapshot
                </p>
                <p className="text-sm font-semibold">
                  {compareTarget.title} ({new Date(compareTarget.createdAt).toLocaleString()})
                </p>
              </div>
              <button
                onClick={() => setShowDiff(false)}
                className="text-sm text-zinc-500 hover:text-zinc-900"
              >
                Close ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-0 border-b border-zinc-200">
              <div className="border-r border-zinc-200">
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase text-zinc-500">
                  Snapshot
                </div>
                <div className="max-h-[400px] overflow-auto px-4 py-3 text-sm leading-relaxed">
                  <div dangerouslySetInnerHTML={{ __html: diffHtml.leftHtml }} />
                </div>
              </div>
              <div>
                <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase text-zinc-500">
                  Current Draft
                </div>
                <div className="max-h-[400px] overflow-auto px-4 py-3 text-sm leading-relaxed">
                  <div dangerouslySetInnerHTML={{ __html: diffHtml.rightHtml }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
