import { describe, expect, it } from "vitest";
import { hostnameOf } from "./source-url";

describe("hostnameOf", () => {
  it("strips the scheme, path and www prefix", () => {
    expect(hostnameOf("https://www.bbcgoodfood.com/recipes/carbonara")).toBe("bbcgoodfood.com");
  });

  it("keeps a subdomain that is not www", () => {
    expect(hostnameOf("https://cooking.nytimes.com/recipes/1024")).toBe("cooking.nytimes.com");
  });

  it("drops a port", () => {
    expect(hostnameOf("http://example.com:8080/r/1")).toBe("example.com");
  });

  it("drops userinfo rather than reading it as the host", () => {
    expect(hostnameOf("https://user:pw@example.com/path")).toBe("example.com");
  });

  it("lowercases the host", () => {
    expect(hostnameOf("HTTPS://WWW.Example.COM/Recipe")).toBe("example.com");
  });

  it("drops the DNS root dot", () => {
    expect(hostnameOf("https://bbc.co.uk./food")).toBe("bbc.co.uk");
  });

  it("handles a bare origin with no path", () => {
    expect(hostnameOf("https://example.com")).toBe("example.com");
  });

  it("handles a query string with no path", () => {
    expect(hostnameOf("https://example.com?id=4")).toBe("example.com");
  });

  // The null cases all render nothing. A wrong credit is worse than none.
  it("returns null for null and empty input", () => {
    expect(hostnameOf(null)).toBeNull();
    expect(hostnameOf("")).toBeNull();
    expect(hostnameOf("   ")).toBeNull();
  });

  it("returns null for a string that is not a URL", () => {
    expect(hostnameOf("Mum's recipe book")).toBeNull();
    expect(hostnameOf("example.com/recipes")).toBeNull();
  });

  it("returns null for a host with no dot", () => {
    expect(hostnameOf("http://localhost:3000/recipes/1")).toBeNull();
  });

  it("does not match a URL buried in a longer string", () => {
    expect(hostnameOf("see https://example.com for details")).toBeNull();
  });
});
