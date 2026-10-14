// Run with: node --test   (Node's built-in test runner, no dependencies)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseNumber } from "../site/lib/csv.js";

describe("parseCsv", () => {
  it("reads a header and rows into records", () => {
    assert.deepEqual(parseCsv("Count,RelicCost\n1,1.000E+00\n2,5.300E+01\n"), [
      { Count: "1", RelicCost: "1.000E+00" },
      { Count: "2", RelicCost: "5.300E+01" }
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    assert.deepEqual(parseCsv('ArtifactID,L40\nSeasonalArtifact31,"2,578.91"\n'), [
      { ArtifactID: "SeasonalArtifact31", L40: "2,578.91" }
    ]);
  });

  it("handles a BOM, CRLF line endings and doubled quotes", () => {
    assert.deepEqual(parseCsv('\uFEFFA,B\r\n"say ""hi""",2\r\n'), [{ A: 'say "hi"', B: "2" }]);
  });

  it("skips empty lines and fills missing trailing cells with empty strings", () => {
    assert.deepEqual(parseCsv("A,B\n\n1\n"), [{ A: "1", B: "" }]);
  });

  it("trims spaces around headers and cells", () => {
    assert.deepEqual(parseCsv("A , B\n 1 , 2 \n"), [{ A: "1", B: "2" }]);
  });

  it("returns no records for an empty text", () => {
    assert.deepEqual(parseCsv(""), []);
  });
});

describe("parseNumber", () => {
  it("reads whole, decimal and scientific notations", () => {
    assert.equal(parseNumber("40"), 40);
    assert.equal(parseNumber("2.260"), 2.26);
    assert.equal(parseNumber("2.00E+01"), 20);
    assert.equal(parseNumber("1.00E+14"), 1e14);
    assert.equal(parseNumber("1.132E+115"), 1.132e115);
    assert.equal(parseNumber("-0.5"), -0.5);
  });

  it("rejects anything else as NaN", () => {
    for (const text of ["", "2,578.91", "abc", "1e", " 12", "0x10", "Infinity", "1.2.3"]) {
      assert.ok(Number.isNaN(parseNumber(text)), JSON.stringify(text));
    }
  });
});
