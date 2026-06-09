import { JSDOM } from "jsdom";
// @ts-expect-error - Bun provides this module during `bun test`
import { mock } from "bun:test";
import * as vanillaExtractStub from "../mocks/vanilla-extract-css-stub.ts";

if (typeof globalThis.window === "undefined" || typeof globalThis.document === "undefined") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  const { window } = dom;

  globalThis.window = window as unknown as Window & typeof globalThis.window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLDivElement = window.HTMLDivElement;
  globalThis.HTMLSpanElement = window.HTMLSpanElement;
  globalThis.HTMLButtonElement = window.HTMLButtonElement;
  globalThis.HTMLInputElement = window.HTMLInputElement;
  globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
  globalThis.HTMLSelectElement = window.HTMLSelectElement;
  globalThis.SVGElement = window.SVGElement;
  globalThis.Node = window.Node;
  const nodeFilterFallback = {
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,
    SHOW_ALL: -1,
    SHOW_ELEMENT: 1,
    SHOW_TEXT: 4,
  };

  const nodeFilter = window.NodeFilter ?? nodeFilterFallback;
  globalThis.NodeFilter = nodeFilter as typeof NodeFilter;
  window.NodeFilter = nodeFilter as typeof window.NodeFilter;

  const elementCtor = window.Element ?? window.HTMLElement;
  if (elementCtor) {
    globalThis.Element = elementCtor as typeof Element;
  }
  globalThis.Event = window.Event;
  globalThis.FocusEvent = window.FocusEvent;
  globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.PointerEvent = (window.PointerEvent ?? window.MouseEvent) as typeof PointerEvent;
  globalThis.CustomEvent = window.CustomEvent;
  globalThis.navigator = {
    ...window.navigator,
    userAgent: "bun-test",
  };
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);

  class StubMutationObserver implements MutationObserver {
    takeRecords(): MutationRecord[] {
      return [];
    }

    observe(): void {}

    disconnect(): void {}
  }

  if (typeof globalThis.MutationObserver === "undefined") {
    globalThis.MutationObserver = StubMutationObserver as unknown as typeof MutationObserver;
  }

  if (typeof window.MutationObserver === "undefined") {
    window.MutationObserver = StubMutationObserver as unknown as typeof MutationObserver;
  }

  let rafId = 0;
  const rafTimers = new Map<number, ReturnType<typeof setTimeout>>();

  const requestAnimationFrameImpl = typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame.bind(window)
    : (callback: FrameRequestCallback): number => {
      rafId += 1;
      const handle = rafId;
      const timer = setTimeout(() => {
        rafTimers.delete(handle);
        callback(Date.now());
      }, 16);
      rafTimers.set(handle, timer);
      return handle;
    };

  const cancelAnimationFrameImpl = typeof window.cancelAnimationFrame === "function"
    ? window.cancelAnimationFrame.bind(window)
    : (handle: number): void => {
      const timer = rafTimers.get(handle);
      if (timer) {
        clearTimeout(timer);
        rafTimers.delete(handle);
      }
    };

  window.requestAnimationFrame = requestAnimationFrameImpl as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = cancelAnimationFrameImpl as typeof window.cancelAnimationFrame;

  globalThis.requestAnimationFrame = requestAnimationFrameImpl;
  globalThis.cancelAnimationFrame = cancelAnimationFrameImpl;
}

mock.module("@vanilla-extract/css", () => ({ ...vanillaExtractStub }));
