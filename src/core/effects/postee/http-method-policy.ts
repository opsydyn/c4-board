import { Match } from "effect";
import type { HttpMethod, PreparedBody, RequestBody } from "./types";

export interface HttpMethodPolicy {
  readonly safe: boolean;
  readonly idempotent: boolean;
  readonly content: "forbidden" | "optional" | "required";
  readonly requiresContentType: boolean;
}

export interface EffectiveRequestHeader {
  readonly key: string;
  readonly value: string;
}

export type RequestContent = RequestBody | PreparedBody;

export type RequestSemanticsIssue =
  | "QUERY requires request content."
  | "QUERY requires a Content-Type for its request content.";

const HTTP_METHOD_POLICIES: Record<HttpMethod, HttpMethodPolicy> = {
  GET: {
    safe: true,
    idempotent: true,
    content: "forbidden",
    requiresContentType: false,
  },
  POST: {
    safe: false,
    idempotent: false,
    content: "optional",
    requiresContentType: false,
  },
  PUT: {
    safe: false,
    idempotent: true,
    content: "optional",
    requiresContentType: false,
  },
  PATCH: {
    safe: false,
    idempotent: false,
    content: "optional",
    requiresContentType: false,
  },
  DELETE: {
    safe: false,
    idempotent: true,
    content: "optional",
    requiresContentType: false,
  },
  HEAD: {
    safe: true,
    idempotent: true,
    content: "forbidden",
    requiresContentType: false,
  },
  OPTIONS: {
    safe: true,
    idempotent: true,
    content: "optional",
    requiresContentType: false,
  },
  TRACE: {
    safe: true,
    idempotent: true,
    content: "forbidden",
    requiresContentType: false,
  },
  QUERY: {
    safe: true,
    idempotent: true,
    content: "required",
    requiresContentType: true,
  },
};

const findContentType = (
  headers: ReadonlyArray<EffectiveRequestHeader>,
): EffectiveRequestHeader | undefined =>
  headers.find(
    (header) =>
      header.key.trim().toLowerCase() === "content-type"
      && header.value.trim().length > 0,
  );

const inferContentType = (body: RequestContent): string | null =>
  Match.value(body).pipe(
    Match.tag("None", () => null),
    Match.tag("Raw", () => null),
    Match.tag("Json", () => "application/json; charset=utf-8"),
    Match.tag("Form", () => "application/x-www-form-urlencoded"),
    Match.exhaustive,
  );

export const getHttpMethodPolicy = (method: HttpMethod): HttpMethodPolicy => HTTP_METHOD_POLICIES[method];

export const hasRequestContent = (body: RequestContent): boolean =>
  Match.value(body).pipe(
    Match.tag("None", () => false),
    Match.tag("Raw", ({ content }) => content.length > 0),
    Match.tag("Json", ({ content }) => content.length > 0),
    Match.tag("Form", ({ entries }) => entries.length > 0),
    Match.exhaustive,
  );

export const evaluateRequestSemantics = (
  method: HttpMethod,
  headers: ReadonlyArray<EffectiveRequestHeader>,
  body: RequestContent,
): RequestSemanticsIssue | null => {
  const policy = getHttpMethodPolicy(method);

  if (method !== "QUERY") {
    return null;
  }

  if (!hasRequestContent(body)) {
    return "QUERY requires request content.";
  }

  if (
    policy.requiresContentType
    && !findContentType(headers)
    && !inferContentType(body)
  ) {
    return "QUERY requires a Content-Type for its request content.";
  }

  return null;
};

export const completeContentTypeHeaders = (
  headers: ReadonlyArray<EffectiveRequestHeader>,
  body: RequestContent,
): ReadonlyArray<EffectiveRequestHeader> => {
  if (!hasRequestContent(body) || findContentType(headers)) {
    return headers;
  }

  const contentType = inferContentType(body);
  return contentType === null
    ? headers
    : [...headers, { key: "content-type", value: contentType }];
};

export const serializeRequestBody = (body: RequestContent): string | null =>
  Match.value(body).pipe(
    Match.tag("None", () => null),
    Match.tag("Raw", ({ content }) => (content.length > 0 ? content : null)),
    Match.tag("Json", ({ content }) => (content.length > 0 ? content : null)),
    Match.tag("Form", ({ entries }) => {
      if (entries.length === 0) {
        return null;
      }

      const form = new URLSearchParams();
      for (const [key, value] of entries) {
        form.append(key, value);
      }
      return form.toString();
    }),
    Match.exhaustive,
  );
