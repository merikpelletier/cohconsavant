const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../api/_lib/aiQuoteMath.js'), 'utf8');
  const { finalTokenPrice, costForLine, buildQuotePlan, selectRate } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const settings = { usd_to_cad_rate: 1.35, token_value_cad: 0.1 };
  // Test values only; never installed as commercial settings.
  const result = finalTokenPrice(1, settings);
  assert.equal(result.tokens, 23);
  assert.ok(result.margin_percent >= 40);
  assert.equal(finalTokenPrice(1, settings, 30).tokens, 30);
  for (const usd of [0.000001, 0.1, 1, 10, 100]) for (const fx of [0.7, 1.35, 2]) {
    assert.ok(finalTokenPrice(usd, { ...settings, usd_to_cad_rate: fx }).margin_percent >= 40 - 1e-10);
  }
  for (const bad of [null, 0, -1, NaN, Infinity]) {
    assert.throws(() => finalTokenPrice(1, { ...settings, usd_to_cad_rate: bad }));
    assert.throws(() => finalTokenPrice(1, { ...settings, token_value_cad: bad }));
  }
  const rate = { model_key: 'test/model', is_active: true, quote_enabled: true, billing_type: 'per_1k_characters', unit_price_usd: 0.1 };
  assert.equal(costForLine({ characters: 2000 }, rate).cost_usd, 0.2);
  assert.throws(() => costForLine({ characters: 2000 }, { ...rate, quote_enabled: false }));
  assert.throws(() => costForLine({}, { ...rate, billing_type: 'per_output_second' }));
  assert.equal(costForLine({ output_seconds: 10 }, { ...rate, billing_type: 'per_output_second' }).cost_usd, 1);
  assert.throws(() => costForLine({}, { ...rate, billing_type: 'per_second' }));
  assert.equal(costForLine({}, { ...rate, billing_type: 'per_second', max_runtime_seconds: 120 }).cost_usd, 12);
  assert.equal(costForLine({ input_token_bound: 1000, output_token_bound: 500 }, { ...rate, billing_type: 'per_1k_tokens', output_unit_price_usd: 0.2 }).cost_usd, 0.2);
  assert.throws(() => selectRate({ ...rate, quote_variants: [{ match: { duration: 5 } }] }, { duration: 10 }));
  assert.throws(() => selectRate({ ...rate, quote_variants: [{ match: {} }, { match: {} }] }));
  assert.equal(buildQuotePlan('generateSpeech', { text: ' bonjour ' }).lines[0].characters, 7);
  assert.throws(() => buildQuotePlan('generateSpeech', { text: 'x'.repeat(10001) }));
  assert.equal(buildQuotePlan('generateVideo', { duration: 10 }).lines.length, 2);
  assert.equal(buildQuotePlan('generateVideo', { duration: 10 }).lines[1].output_seconds, 10);
  assert.equal(buildQuotePlan('replicateGenerate', { method: 'faceswitch' }).lines.length, 2);
  assert.equal(buildQuotePlan('replicateGenerate', { method: 'generate_3d', photo_url: 'test' }).lines.length, 1);
  assert.throws(() => buildQuotePlan('unknown', {}));
  console.log('AI quote tests passed: USD/CAD, 40% margin, rounding, missing rates, units, variants and plans. No provider calls.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
