import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor, type RecipeCursor } from "./cursor";

describe("cursor encoding", () => {
  it("round-trips an updatedAt cursor", () => {
    const cursor: RecipeCursor = {
      k: "updatedAt",
      v: "2026-09-07T10:30:00.000Z",
      id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("round-trips a title cursor", () => {
    const cursor: RecipeCursor = {
      k: "title",
      v: "Sourdough Focaccia",
      id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("round-trips a likeCount cursor", () => {
    const cursor: RecipeCursor = {
      k: "likeCount",
      v: 42,
      id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("survives titles containing characters that need escaping", () => {
    const cursor: RecipeCursor = {
      k: "title",
      v: 'Bread & "Butter" / Café — 100% rye',
      id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("produces a URL-safe string needing no further encoding", () => {
    const encoded = encodeCursor({
      k: "title",
      v: "Ratatouille ?&=#+/ test",
      id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    });
    expect(encoded).toBe(encodeURIComponent(encoded));
  });
});

describe("decodeCursor rejects bad input", () => {
  // A malformed cursor should read as "start from the beginning" rather than
  // throwing — these arrive from URLs and browser history and must degrade
  // gracefully rather than erroring the request.
  it("returns null for null and undefined", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(decodeCursor("")).toBeNull();
  });

  it("returns null for non-base64 junk", () => {
    expect(decodeCursor("!!!not-base64!!!")).toBeNull();
  });

  it("returns null for base64 that isn't JSON", () => {
    expect(decodeCursor(Buffer.from("hello", "utf8").toString("base64url"))).toBeNull();
  });

  it("returns null for JSON that isn't a cursor shape", () => {
    const notACursor = Buffer.from(JSON.stringify({ foo: "bar" }), "utf8").toString("base64url");
    expect(decodeCursor(notACursor)).toBeNull();
  });

  it("returns null when the id is missing", () => {
    const noId = Buffer.from(JSON.stringify({ k: "title", v: "x" }), "utf8").toString("base64url");
    expect(decodeCursor(noId)).toBeNull();
  });

  it("returns null when the key is unrecognised", () => {
    const badKey = Buffer.from(
      JSON.stringify({ k: "somethingElse", v: "x", id: "abc" }),
      "utf8",
    ).toString("base64url");
    expect(decodeCursor(badKey)).toBeNull();
  });

  it("returns null when a likeCount value is not a finite number", () => {
    const nan = Buffer.from(
      JSON.stringify({ k: "likeCount", v: "not-a-number", id: "abc" }),
      "utf8",
    ).toString("base64url");
    expect(decodeCursor(nan)).toBeNull();
  });

  it("returns null when a string cursor carries a numeric value", () => {
    const wrongType = Buffer.from(
      JSON.stringify({ k: "title", v: 5, id: "abc" }),
      "utf8",
    ).toString("base64url");
    expect(decodeCursor(wrongType)).toBeNull();
  });

  it("returns null for a JSON array", () => {
    const arr = Buffer.from(JSON.stringify([1, 2, 3]), "utf8").toString("base64url");
    expect(decodeCursor(arr)).toBeNull();
  });
});
