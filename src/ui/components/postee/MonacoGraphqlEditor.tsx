import Editor, { type Monaco } from "@monaco-editor/react";
import type { GraphQLSchema } from "graphql";
import { getAutocompleteSuggestions, getDiagnostics, getHoverInformation } from "graphql-language-service";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useRef } from "react";
import { configurePosteeMonaco } from "./monaco-loader";
import { graphqlEditor } from "./MonacoGraphqlEditor.css";

configurePosteeMonaco();

const GRAPHQL_LANGUAGE_ID = "postee-graphql";
const GRAPHQL_MARKER_OWNER = "postee-graphql";

const schemasByModel = new Map<string, GraphQLSchema | null>();
let activeEditorCount = 0;
let languageRegistered = false;
let providerDisposables: Array<{ dispose: () => void }> = [];

const toGraphqlPosition = (position: { readonly lineNumber: number; readonly column: number }) => ({
  line: position.lineNumber - 1,
  character: position.column - 1,
  setLine: () => {},
  setCharacter: () => {},
  lessThanOrEqualTo: () => false,
});

const toMonacoRange = (range: {
  start: { line: number; character: number };
  end: { line: number; character: number };
}) => ({
  startLineNumber: range.start.line + 1,
  startColumn: range.start.character + 1,
  endLineNumber: range.end.line + 1,
  endColumn: range.end.character + 1,
});

const toMarkerSeverity = (monaco: Monaco, severity: number | undefined) => {
  switch (severity) {
    case 2:
      return monaco.MarkerSeverity.Warning;
    case 3:
      return monaco.MarkerSeverity.Info;
    case 4:
      return monaco.MarkerSeverity.Hint;
    default:
      return monaco.MarkerSeverity.Error;
  }
};

const updateDiagnostics = (
  monaco: Monaco,
  model: editor.ITextModel,
) => {
  const schema = schemasByModel.get(model.uri.toString()) ?? null;
  const markers = getDiagnostics(model.getValue(), schema).map((diagnostic) => ({
    ...toMonacoRange(diagnostic.range),
    message: diagnostic.message,
    severity: toMarkerSeverity(monaco, diagnostic.severity),
    source: "GraphQL",
  }));
  monaco.editor.setModelMarkers(model, GRAPHQL_MARKER_OWNER, markers);
};

const ensureGraphqlProviders = (monaco: Monaco) => {
  if (providerDisposables.length > 0) return;

  if (!languageRegistered) {
    monaco.languages.register({ id: GRAPHQL_LANGUAGE_ID });
    languageRegistered = true;
  }
  providerDisposables = [
    monaco.languages.setMonarchTokensProvider(GRAPHQL_LANGUAGE_ID, {
      tokenizer: {
        root: [
          [/#[^\n]*/, "comment"],
          [
            /\b(query|mutation|subscription|fragment|on|schema|type|interface|union|enum|input|scalar|directive|extend)\b/,
            "keyword",
          ],
          [/\$[A-Za-z_][A-Za-z0-9_]*/, "variable"],
          [/@[A-Za-z_][A-Za-z0-9_]*/, "annotation"],
          [/[A-Za-z_][A-Za-z0-9_]*/, "identifier"],
          [/"(?:[^"\\]|\\.)*"/, "string"],
          [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, "number"],
          [/[!$():=@[\]{|}]/, "delimiter"],
        ],
      },
    }),
    monaco.languages.registerCompletionItemProvider(GRAPHQL_LANGUAGE_ID, {
      provideCompletionItems: (
        model: editor.ITextModel,
        position: { readonly lineNumber: number; readonly column: number },
      ) => {
        const schema = schemasByModel.get(model.uri.toString());
        if (!schema) return { suggestions: [] };

        return {
          suggestions: getAutocompleteSuggestions(
            schema,
            model.getValue(),
            toGraphqlPosition(position),
          ).map((suggestion) => ({
            label: suggestion.label,
            detail: suggestion.detail,
            documentation: suggestion.documentation ?? undefined,
            insertText: suggestion.insertText ?? suggestion.rawInsert ?? suggestion.label,
            kind: monaco.languages.CompletionItemKind.Field,
          })),
        };
      },
    }),
    monaco.languages.registerHoverProvider(GRAPHQL_LANGUAGE_ID, {
      provideHover: (
        model: editor.ITextModel,
        position: { readonly lineNumber: number; readonly column: number },
      ) => {
        const schema = schemasByModel.get(model.uri.toString());
        if (!schema) return null;

        const contents = getHoverInformation(
          schema,
          model.getValue(),
          toGraphqlPosition(position),
          undefined,
          { useMarkdown: true },
        );
        if (!contents) return null;

        const values = (Array.isArray(contents) ? contents : [contents]).map((content) => {
          if (typeof content === "string") return { value: content };
          return { value: content.value };
        });
        return { contents: values };
      },
    }),
  ];
};

const releaseGraphqlProviders = () => {
  activeEditorCount -= 1;
  if (activeEditorCount > 0) return;

  activeEditorCount = 0;
  providerDisposables.forEach((provider) => provider.dispose());
  providerDisposables = [];
};

export interface MonacoGraphqlEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly schema: GraphQLSchema | null;
  readonly readOnly: boolean;
  readonly height?: string;
}

export function MonacoGraphqlEditor({
  value,
  onChange,
  schema,
  readOnly,
  height = "clamp(180px, 42vh, 620px)",
}: MonacoGraphqlEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const disposeRef = useRef<(() => void) | null>(null);

  const refreshDiagnostics = useCallback(() => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (monaco && model) updateDiagnostics(monaco, model);
  }, []);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (model) schemasByModel.set(model.uri.toString(), schema);
    refreshDiagnostics();
  }, [refreshDiagnostics, schema]);

  useEffect(() => () => disposeRef.current?.(), []);

  const handleMount = useCallback((editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    const model = editorInstance.getModel();
    if (!model) return;

    activeEditorCount += 1;
    ensureGraphqlProviders(monaco);
    schemasByModel.set(model.uri.toString(), schema);
    editorRef.current = editorInstance;
    monacoRef.current = monaco;
    updateDiagnostics(monaco, model);

    const contentListener = editorInstance.onDidChangeModelContent(() => updateDiagnostics(monaco, model));
    disposeRef.current = () => {
      contentListener.dispose();
      schemasByModel.delete(model.uri.toString());
      monaco.editor.setModelMarkers(model, GRAPHQL_MARKER_OWNER, []);
      releaseGraphqlProviders();
      disposeRef.current = null;
    };
  }, [schema]);

  return (
    <div className={graphqlEditor}>
      <Editor
        height={height}
        defaultLanguage={GRAPHQL_LANGUAGE_ID}
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        onMount={handleMount}
        theme="postee-dark"
        options={{
          readOnly,
          ariaLabel: "GraphQL document",
          automaticLayout: true,
          fontSize: 13,
          lineNumbers: "on",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 2,
          insertSpaces: true,
          wordWrap: "on",
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          hover: { enabled: true, delay: 300 },
          padding: { top: 8, bottom: 8 },
        }}
      />
    </div>
  );
}
