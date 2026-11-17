import assert from "node:assert/strict";
import test from "node:test";
import { formatPhone, normalisePhone, splitPhone } from "../lib/country-codes.ts";

test("adds the selected country code to local numbers and drops the leading zero", () => {
  assert.equal(normalisePhone("0803 555 0147", "+234"), "+2348035550147");
  assert.equal(normalisePhone("024-555-0123", "+233"), "+233245550123");
});

test("keeps numbers that already have a country code", () => {
  assert.equal(normalisePhone("+44 7700 900123", "+234"), "+447700900123");
  assert.equal(normalisePhone("00254 712 345678", "+234"), "+254712345678");
});

test("rejects implausible numbers and allows empty input", () => {
  assert.equal(normalisePhone("12345", "+234"), null);
  assert.equal(normalisePhone("", "+234"), "");
});

test("splits and formats stored numbers", () => {
  assert.deepEqual(splitPhone("+2348035550147"), ["+234", "8035550147"]);
  assert.deepEqual(splitPhone("+12025550143"), ["+1", "2025550143"]);
  assert.equal(formatPhone("+2348035550147"), "+234 803 555 0147");
});
