import { describe, expect, it } from "vitest";
import { importFailureMessage } from "./recipe-import";

/**
 * These assert on what the reader is told, not on exact wording, because the
 * wording is the thing most likely to be improved later and the meaning is the
 * thing that must not regress.
 *
 * The bar each message has to clear: whose fault is it, is it worth retrying,
 * and is there anything else the user can do.
 */

const HOST = "bbcgoodfood.com";

const http = (status: number): string => importFailureMessage({ kind: "http", status }, HOST);
const network = (error: unknown): string => importFailureMessage({ kind: "network", error }, HOST);

function errorWithCode(code: string): Error {
  return Object.assign(new Error("fetch failed"), { cause: { code } });
}

describe("importFailureMessage", () => {
  it("names the site so the message is about a page, not about sousChef", () => {
    expect(http(404)).toContain(HOST);
    expect(network(errorWithCode("ENOTFOUND"))).toContain(HOST);
  });

  it("explains a paywall and points at the way round it", () => {
    for (const status of [401, 403]) {
      expect(http(status)).toMatch(/paywall/i);
      expect(http(status)).toMatch(/paste text/i);
    }
  });

  it("tells the user to check the link on a 404", () => {
    expect(http(404)).toMatch(/check the link/i);
    expect(http(410)).toMatch(/no page at that address/i);
  });

  it("distinguishes a temporary fault from a permanent one", () => {
    // A 5xx is worth retrying and is not the user's fault; saying so stops them
    // re-checking a link that was fine.
    expect(http(503)).toMatch(/isn't your link/i);
    expect(http(429)).toMatch(/few minutes/i);
  });

  it("does not leak fetch-speak into user-facing text", () => {
    // The message this replaced was "Failed to fetch URL (HTTP 403)".
    for (const status of [401, 403, 404, 429, 500, 503]) {
      expect(http(status)).not.toMatch(/failed to fetch/i);
    }
  });

  it("treats both timeout spellings the same", () => {
    // AbortSignal.timeout rejects with TimeoutError; some runtimes report
    // AbortError. The reader should not be able to tell which.
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(network(timeout)).toMatch(/took too long/i);
    expect(network(abort)).toMatch(/took too long/i);
  });

  it("reads DNS and connection failures from the cause code, not the message", () => {
    // Undici's own message is always "fetch failed"; the code is the only signal.
    expect(network(errorWithCode("ENOTFOUND"))).toMatch(/couldn't find/i);
    expect(network(errorWithCode("EAI_AGAIN"))).toMatch(/couldn't find/i);
    expect(network(errorWithCode("ECONNREFUSED"))).toMatch(/closed the connection/i);
    expect(network(errorWithCode("ERR_TLS_CERT_ALTNAME_INVALID"))).toMatch(/certificate/i);
    expect(network(errorWithCode("CERT_HAS_EXPIRED"))).toMatch(/certificate/i);
  });

  it("still says something useful for a cause it does not recognise", () => {
    expect(network(new Error("something odd"))).toMatch(/couldn't reach/i);
    expect(network("not an error at all")).toMatch(/check the address/i);
  });

  it("falls back to a generic subject when there is no host", () => {
    expect(importFailureMessage({ kind: "http", status: 404 }, "")).toMatch(/that site/i);
  });
});
