import { loader } from "@monaco-editor/react";

const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");

loader.config({ paths: { vs: `${baseUrl}monaco/vs` } });

export const configurePosteeMonaco = (): void => {};
