const test = require("node:test");
const assert = require("node:assert/strict");
const { deriveBatchStatus } = require("../src/services/inventory.service");

test("deriveBatchStatus returns expired for old date", () => {
  const status = deriveBatchStatus(new Date(Date.now() - 86400000), 10);
  assert.equal(status, "Expired");
});

test("deriveBatchStatus returns near expiry in <=3 days", () => {
  const status = deriveBatchStatus(new Date(Date.now() + 2 * 86400000), 10);
  assert.equal(status, "NearExpiry");
});

test("deriveBatchStatus returns out of stock when zero qty", () => {
  const status = deriveBatchStatus(new Date(Date.now() + 10 * 86400000), 0);
  assert.equal(status, "OutOfStock");
});
