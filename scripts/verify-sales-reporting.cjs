const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const ts = require('typescript')
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file)
  const exports = {}
  cache.set(file, exports)
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
  new Function('require', 'exports', js)((name) => name.startsWith('.') ? load(path.resolve(path.dirname(file), `${name}.ts`)) : require(name), exports)
  return exports
}
const { validCallback, matchesCallback, matchesLocalDateRange, reportTime, callSeconds } = load(path.resolve(__dirname, '../src/salesReporting.ts'))
const dayjs = require('dayjs')
const now = dayjs.utc('2026-09-08T00:00:00Z')
assert.equal(validCallback('not-a-date'), undefined)
assert.equal(matchesCallback('not-a-date', 'filled', now), false)
assert.equal(matchesCallback('', 'due', now), false)
assert.equal(matchesCallback('2026-09-08T00:00:00Z', 'due', now), true)
assert.equal(matchesCallback('2026-09-09T00:00:00Z', 'upcoming', now), true)
assert.equal(matchesCallback('2026-09-09T00:00:01Z', 'upcoming', now), false)
const range = [dayjs('2026-09-08'), dayjs('2026-09-08')]
assert.equal(matchesLocalDateRange('2026-09-07T15:30:00Z', range, '韩国'), true)
assert.equal(matchesLocalDateRange('2026-09-07T15:30:00Z', range, '越南'), false)
assert.match(reportTime('2026-09-07T15:30:00Z', '韩国'), /2026-09-08 00:30/)
assert.equal(reportTime('invalid', '韩国'), '—')
assert.equal(callSeconds({ result: '无人接听', duration: '10:00' }), 0)
assert.equal(callSeconds({ result: '已接通', duration: '1:75' }), 0)
assert.equal(callSeconds({ result: '已接通', duration: '12:34' }), 754)
console.log('PASS: 13 callback, timezone, and call-duration checks')
