import { describe, expect, it } from "vitest";
import { prepareGraphqlDraft } from "./graphql";
import { RequestBody } from "./types";

describe("prepareGraphqlDraft", () => {
  it("derives a JSON request body and protocol headers", () => {
    expect(prepareGraphqlDraft({
      document: "query Viewer { viewer { id } }",
      variablesJson: "{\"includeEmail\":true}",
      operationName: "Viewer",
    })).toEqual({
      issue: null,
      operationNames: ["Viewer"],
      body: RequestBody.Json({
        content: JSON.stringify({
          query: "query Viewer { viewer { id } }",
          variables: { includeEmail: true },
          operationName: "Viewer",
        }),
      }),
      protocolHeaders: [
        { key: "Content-Type", value: "application/json; charset=utf-8" },
        { key: "Accept", value: "application/graphql-response+json, application/json;q=0.9" },
      ],
    });
  });

  it.each([
    ["", "{}", null, "GraphQL requires an operation document."],
    ["query {", "{}", null, "GraphQL document is invalid."],
    ["query Viewer { viewer { id } }", "[1]", "Viewer", "GraphQL variables must be a JSON object."],
  ])("returns a specific issue for invalid input", (document, variablesJson, operationName, issue) => {
    expect(prepareGraphqlDraft({ document, variablesJson, operationName }).issue).toBe(issue);
  });

  it("requires a current selected operation for multiple operations", () => {
    const document = "query One { one } query Two { two }";
    expect(prepareGraphqlDraft({ document, variablesJson: "{}", operationName: null }).issue)
      .toBe("GraphQL requires an operation selection.");
    expect(prepareGraphqlDraft({ document, variablesJson: "{}", operationName: "Missing" }).issue)
      .toBe("The selected GraphQL operation no longer exists.");
  });
});
