import { Kind, parse } from "graphql";
import type { EffectiveRequestHeader } from "./http-method-policy";
import { RequestBody } from "./types";

export interface GraphqlDraft {
  readonly document: string;
  readonly variablesJson: string;
  readonly operationName: string | null;
}

export type GraphqlDraftIssue =
  | "GraphQL requires an operation document."
  | "GraphQL document is invalid."
  | "GraphQL variables must be valid JSON."
  | "GraphQL variables must be a JSON object."
  | "GraphQL requires an operation selection."
  | "The selected GraphQL operation no longer exists.";

export interface GraphqlPreparation {
  readonly issue: GraphqlDraftIssue | null;
  readonly operationNames: ReadonlyArray<string>;
  readonly body: ReturnType<typeof RequestBody.Json> | null;
  readonly protocolHeaders: ReadonlyArray<EffectiveRequestHeader>;
}

const protocolHeaders: ReadonlyArray<EffectiveRequestHeader> = [
  { key: "Content-Type", value: "application/json; charset=utf-8" },
  { key: "Accept", value: "application/graphql-response+json, application/json;q=0.9" },
];

const preparationIssue = (issue: GraphqlDraftIssue, operationNames: ReadonlyArray<string>): GraphqlPreparation => ({
  issue,
  operationNames,
  body: null,
  protocolHeaders,
});

export const prepareGraphqlDraft = (draft: GraphqlDraft): GraphqlPreparation => {
  if (draft.document.trim().length === 0) {
    return preparationIssue("GraphQL requires an operation document.", []);
  }

  let operationNames: ReadonlyArray<string>;
  try {
    const document = parse(draft.document);
    operationNames = document.definitions
      .filter((definition) => definition.kind === Kind.OPERATION_DEFINITION)
      .flatMap((definition) => definition.name ? [definition.name.value] : []);
    if (!document.definitions.some((definition) => definition.kind === Kind.OPERATION_DEFINITION)) {
      return preparationIssue("GraphQL requires an operation document.", operationNames);
    }
  } catch {
    return preparationIssue("GraphQL document is invalid.", []);
  }

  let variables: Record<string, unknown> | undefined;
  if (draft.variablesJson.trim().length > 0) {
    try {
      const parsed: unknown = JSON.parse(draft.variablesJson);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return preparationIssue("GraphQL variables must be a JSON object.", operationNames);
      }
      variables = parsed as Record<string, unknown>;
    } catch {
      return preparationIssue("GraphQL variables must be valid JSON.", operationNames);
    }
  }

  if (operationNames.length > 1 && draft.operationName === null) {
    return preparationIssue("GraphQL requires an operation selection.", operationNames);
  }
  if (draft.operationName !== null && !operationNames.includes(draft.operationName)) {
    return preparationIssue("The selected GraphQL operation no longer exists.", operationNames);
  }

  return {
    issue: null,
    operationNames,
    body: RequestBody.Json({
      content: JSON.stringify({
        query: draft.document,
        ...(variables === undefined ? {} : { variables }),
        ...(draft.operationName === null ? {} : { operationName: draft.operationName }),
      }),
    }),
    protocolHeaders,
  };
};
