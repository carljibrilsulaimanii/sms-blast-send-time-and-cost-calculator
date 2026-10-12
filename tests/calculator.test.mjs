/*
  calculator.test.mjs
  Author:  Jibril Sulaiman, built with Claude
  Run:     npm test   (Node 18+; no dependencies)
  What:    Pulls the segment counter, the Eastern-time converter and the cost function out of
           index.html and checks them at the edges: 160 vs 161 characters, 153-character
           segments, Unicode limits, characters that take two spaces, emoji, daylight saving.
  Why:     The page is one HTML file with no build step, so the tests read the functions
           straight from it. If the page changes, the tests test the new code.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const grab = (re, what) => {
  const m = html.match(re);
  assert.ok(m, `could not find ${what} in index.html`);
  return m[0];
};
const charsets = grab(/var GSM_BASIC = [\s\S]*?(?=var SMART)/, "GSM character sets");
const analyzeSrc = grab(/function analyze\(text\) \{[\s\S]*?\n  \}\n/, "analyze()");
const tzSrc = grab(/var TZ = "America\/New_York";/, "TZ");
const etPartsSrc = grab(/function etParts\(ms\) \{[\s\S]*?\n  \}\n/, "etParts()");
const etToUtcSrc = grab(/function etToUtc\(y, mo, d, h, mi\) \{[\s\S]*?\n  \}\n/, "etToUtc()");
const ratesSrc = grab(/var RATES = \{[\s\S]*?var LRN = [\d.]+;/, "rates");
const costSrc = grab(/function costFor\(bill, units, mms, newContacts\) \{[\s\S]*?\n  \}/, "costFor()");

const lib = new Function(
  tzSrc + charsets + analyzeSrc + etPartsSrc + etToUtcSrc + ratesSrc + costSrc +
  "return { analyze, etToUtc, costFor, RATES, CARRIER, LRN };"
)();

const a = (n, ch = "a") => ch.repeat(n);

test("plain text: 160 fits in one segment, 161 splits 153 + 8", () => {
  assert.deepEqual(lib.analyze(a(160)).fills, [160]);
  assert.deepEqual(lib.analyze(a(161)).fills, [153, 8]);
  assert.equal(lib.analyze(a(161)).limit, 153);
});

test("plain text: 306 is two full segments, 307 needs a third", () => {
  assert.deepEqual(lib.analyze(a(306)).fills, [153, 153]);
  assert.deepEqual(lib.analyze(a(307)).fills, [153, 153, 1]);
});

test("characters that take two spaces are never split across segments", () => {
  // 152 letters + euro sign (2 spaces) would cross 153, so the euro starts segment 2.
  const r = lib.analyze(a(152) + "€" + a(9));
  assert.ok(r.gsm);
  assert.deepEqual(r.fills, [152, 11]);
});

test("one curly apostrophe switches to Unicode: 70, then 67 per segment", () => {
  const r70 = lib.analyze("’" + a(69));
  assert.equal(r70.gsm, false);
  assert.deepEqual(r70.fills, [70]);
  assert.deepEqual(lib.analyze("’" + a(70)).fills, [67, 4]);
  assert.deepEqual(r70.bad, ["’"]);
});

test("an emoji counts as two spaces in Unicode and is not split", () => {
  // 66 letters + emoji (2 spaces) + 5 letters = 73, over 70, so it splits into 67-space segments.
  // The emoji would straddle 66-68, so it moves to segment 2 whole.
  const r = lib.analyze(a(66) + "\u{1F600}" + a(5));
  assert.equal(r.units, 73);
  assert.deepEqual(r.fills, [66, 7]);
  assert.deepEqual(lib.analyze(a(68) + "\u{1F600}").fills, [70]);
});

test("empty message is zero segments", () => {
  assert.equal(lib.analyze("").segments, 0);
});

test("Eastern time converts correctly in daylight and standard time", () => {
  // 7:00 PM EDT on Oct 13 2026 is 23:00 UTC; 7:00 PM EST on Dec 1 2026 is 00:00 UTC next day.
  assert.equal(new Date(lib.etToUtc(2026, 10, 13, 19, 0)).toISOString(), "2026-10-13T23:00:00.000Z");
  assert.equal(new Date(lib.etToUtc(2026, 12, 1, 19, 0)).toISOString(), "2026-12-02T00:00:00.000Z");
});

test("cost adds the send fee, carrier fees and lookups", () => {
  const c = lib.costFor("sc", 1000, false, 10);
  const expected = 1000 * lib.RATES.sc.sms + 1000 * lib.CARRIER.sms + 10 * lib.LRN;
  assert.ok(Math.abs(c.total - expected) < 1e-9);
  const m = lib.costFor("tf", 1000, true, 0);
  assert.ok(Math.abs(m.total - (1000 * lib.RATES.tf.mms + 1000 * lib.CARRIER.mms)) < 1e-9);
});
