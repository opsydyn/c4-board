/**
 * Response body representation and decoding — ADR-010.
 *
 * A response that reached the status line is always delivered to the caller, so
 * the body carries its own success or failure rather than collapsing the whole
 * response. Decoding lives here, in the functional core: the client obtains
 * bytes, and this decides whether those bytes are text.
 */

import { Data, Option } from "effect";

export type ResponseBody = Data.TaggedEnum<{
  /** The body was received in full. It may or may not be text. */
  Decoded: { readonly bytes: Uint8Array };
  /** The body could not be read. Whatever arrived first is kept in `partial`. */
  DecodeFailure: {
    readonly partial: Option.Option<Uint8Array>;
    /** Rendered reason — `cause` alone serialises to `{}` and reports nothing. */
    readonly message: string;
    readonly cause: unknown;
  };
}>;

export const ResponseBody = Data.taggedEnum<ResponseBody>();

const DEFAULT_CHARSET = "utf-8";

/**
 * Reads the charset parameter of a Content-Type, defaulting to UTF-8.
 *
 * Per RFC 9110 the parameter may be quoted, and its name and value are
 * case-insensitive.
 */
export const contentTypeCharset = (contentType: string | null | undefined): string => {
  const match = contentType?.match(/;\s*charset\s*=\s*"?([^";]+)"?/i);
  return match?.[1]?.trim().toLowerCase() || DEFAULT_CHARSET;
};

/**
 * Decodes bytes strictly: invalid sequences yield `None` rather than U+FFFD.
 *
 * Silent replacement is what makes a corrupted body indistinguishable from a
 * legitimate one, so `fatal` is deliberate. An unknown charset label is also a
 * failure to decode rather than a reason to guess.
 */
const decodeBytes = (bytes: Uint8Array, charset: string): Option.Option<string> =>
  Option.flatMap(
    Option.liftThrowable(() => new TextDecoder(charset, { fatal: true }))(),
    (decoder) => Option.liftThrowable((input: Uint8Array) => decoder.decode(input))(bytes),
  );

/**
 * The body as text, when it is text.
 *
 * `None` means the caller should not pretend otherwise: either nothing arrived,
 * or what arrived is not valid text in the declared charset. Partial bytes from a
 * failed body are still worth decoding — a truncated JSON payload is often the
 * most useful diagnostic available.
 */
export const decodeBodyText = (
  body: ResponseBody,
  contentType: string | null | undefined,
): Option.Option<string> => {
  const charset = contentTypeCharset(contentType);
  return ResponseBody.$match(body, {
    Decoded: ({ bytes }) => decodeBytes(bytes, charset),
    DecodeFailure: ({ partial }) => Option.flatMap(partial, (bytes) => decodeBytes(bytes, charset)),
  });
};

/** Byte length actually received, including the partial bytes of a failed body. */
export const responseBodySize = (body: ResponseBody): number =>
  ResponseBody.$match(body, {
    Decoded: ({ bytes }) => bytes.byteLength,
    DecodeFailure: ({ partial }) =>
      Option.match(partial, {
        onNone: () => 0,
        onSome: (bytes) => bytes.byteLength,
      }),
  });
