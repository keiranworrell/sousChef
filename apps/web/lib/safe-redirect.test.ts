import { describe, it, expect } from "vitest";
import { sanitiseRedirect, DEFAULT_POST_AUTH_ROUTE } from "./safe-redirect";

const FALLBACK = DEFAULT_POST_AUTH_ROUTE;

describe("sanitiseRedirect — accepts safe internal paths", () => {
  it("accepts a simple path", () => {
    expect(sanitiseRedirect("/recipes")).toBe("/recipes");
  });

  it("accepts a nested path", () => {
    expect(sanitiseRedirect("/recipes/3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(
      "/recipes/3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    );
  });

  it("preserves the query string", () => {
    expect(sanitiseRedirect("/recipes?sort=title&tag=bread")).toBe("/recipes?sort=title&tag=bread");
  });

  it("preserves the hash", () => {
    expect(sanitiseRedirect("/recipes/abc#ingredients")).toBe("/recipes/abc#ingredients");
  });
});

describe("sanitiseRedirect — rejects off-origin targets", () => {
  // The attack these guard against: send someone
  // /sign-in?next=<attacker URL>, let them authenticate on the real site, then
  // land them on a convincing imitation that asks them to re-enter credentials.
  it("rejects an absolute http URL", () => {
    expect(sanitiseRedirect("https://evil.example/login")).toBe(FALLBACK);
  });

  it("rejects a protocol-relative URL", () => {
    // Browsers treat //host as absolute, inheriting the current scheme
    expect(sanitiseRedirect("//evil.example")).toBe(FALLBACK);
  });

  it("rejects a protocol-relative URL with a path", () => {
    expect(sanitiseRedirect("//evil.example/login")).toBe(FALLBACK);
  });

  it("rejects a backslash-escaped host", () => {
    // Several browsers normalise \ to /, making this protocol-relative
    expect(sanitiseRedirect("/\\evil.example")).toBe(FALLBACK);
    expect(sanitiseRedirect("\\\\evil.example")).toBe(FALLBACK);
  });

  it("rejects a javascript: URL", () => {
    expect(sanitiseRedirect("javascript:alert(1)")).toBe(FALLBACK);
  });

  it("rejects a data: URL", () => {
    expect(sanitiseRedirect("data:text/html,<script>alert(1)</script>")).toBe(FALLBACK);
  });

  it("rejects a bare hostname", () => {
    expect(sanitiseRedirect("evil.example")).toBe(FALLBACK);
  });

  it("rejects a value containing control characters", () => {
    expect(sanitiseRedirect("/recipes\nLocation: https://evil.example")).toBe(FALLBACK);
    expect(sanitiseRedirect("/\tevil")).toBe(FALLBACK);
  });
});

describe("sanitiseRedirect — rejects useless targets", () => {
  it("rejects auth pages, which would bounce the user straight back out", () => {
    expect(sanitiseRedirect("/sign-in")).toBe(FALLBACK);
    expect(sanitiseRedirect("/sign-up")).toBe(FALLBACK);
    expect(sanitiseRedirect("/confirm")).toBe(FALLBACK);
    expect(sanitiseRedirect("/sign-in?next=/recipes")).toBe(FALLBACK);
  });

  it("does not reject paths that merely start with a disallowed word", () => {
    expect(sanitiseRedirect("/sign-in-help")).toBe("/sign-in-help");
  });

  it("falls back on null, undefined and empty", () => {
    expect(sanitiseRedirect(null)).toBe(FALLBACK);
    expect(sanitiseRedirect(undefined)).toBe(FALLBACK);
    expect(sanitiseRedirect("")).toBe(FALLBACK);
  });

  it("honours a custom fallback", () => {
    expect(sanitiseRedirect("https://evil.example", "/somewhere")).toBe("/somewhere");
  });
});
