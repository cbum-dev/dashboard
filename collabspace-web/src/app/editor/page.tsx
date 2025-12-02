"use client";

import { useMemo } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";

const COLLAB_WS_URL =
  process.env.NEXT_PUBLIC_COLLAB_WS_URL ?? "ws://localhost:1234";

// Single shared Yjs document per browser session
const ydoc = new Y.Doc();
const wsProvider = new WebsocketProvider(
  COLLAB_WS_URL,
  "collabspace-demo-room",
  ydoc
);
const yXmlFragment = ydoc.getXmlFragment("prosemirror");

function randomColor() {
  const colors = [
    "#f97316",
    "#22c55e",
    "#3b82f6",
    "#a855f7",
    "#ec4899",
  ];
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
  if (!storedName) {
    window.localStorage.setItem("collabspace:userName", name);
  }
  if (!storedColor) {
    window.localStorage.setItem("collabspace:userColor", color);
  }
  return { name, color };
}

export default function EditorPage() {
  const user = useMemo(() => getLocalUser(), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Yjs manages history
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: wsProvider,
        user,
      }),
    ],
    autofocus: true,
  });

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold">CollabSpace – Real-time Editor</h1>
        <div className="flex items-center gap-2 text-sm text-zinc-700">
          <span
            className="inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: user.color }}
          />
          <span>{user.name}</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          {editor ? (
            <EditorContent editor={editor} className="prose max-w-none" />
          ) : (
            <p className="text-sm text-zinc-500">Loading editor…</p>
          )}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Open this page in multiple browser windows to see real-time
          collaboration, cursors, and presence.
        </p>
      </main>
    </div>
  );
}
