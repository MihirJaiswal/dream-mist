"use client";

import dynamic from "next/dynamic";

/** The editor uses PixiJS and the browser, so it is only rendered on the client */
export const EditorLoader = dynamic(() => import("@/components/editor/editor-app").then(({ EditorApp }) => EditorApp), { ssr: false });
