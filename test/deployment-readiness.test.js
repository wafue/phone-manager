const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const sql = fs.readFileSync('sql/init.sql', 'utf8');
const server = fs.readFileSync('server.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const css = fs.readFileSync('public/style.css', 'utf8');
const client = fs.readFileSync('public/script.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const vietnamHardware = JSON.parse(fs.readFileSync('data/vietnam-hardware.json', 'utf8'));

test('Railway SQL uses the injected database without destructive statements', () => {
  assert.doesNotMatch(sql, /\bCREATE\s+DATABASE\b/i);
  assert.doesNotMatch(sql, /\bUSE\s+/i);
  assert.doesNotMatch(sql, /\bDROP\s+TABLE\b/i);
  assert.match(sql, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+phone_numbers/i);
});

test('uploaded Excel temp files are removed after import attempts', () => {
  assert.match(server, /fs\.unlink/);
  assert.match(server, /finally\s*\{/);
});

test('production can require a shared access password', () => {
  assert.match(server, /ACCESS_PASSWORD/);
  assert.match(server, /app\.use\(requireAccessPassword\)/);
});

test('Excel import avoids the vulnerable xlsx package', () => {
  assert.ok(pkg.dependencies.exceljs);
  assert.equal(pkg.dependencies.xlsx, undefined);
  assert.doesNotMatch(server, /require\('xlsx'\)/);
});

test('Vietnam hardware seed data is ready for fallback import', () => {
  assert.equal(vietnamHardware.length, 20);
  assert.ok(vietnamHardware.every((row) => row.country === '越南'));
  assert.ok(vietnamHardware.every((row) => row.region && row.number));
  assert.match(server, /vietnam-hardware\.json/);
  assert.match(server, /loadJsonNumbers/);
});

test('mobile UI uses a card layout and avoids row-level inline handlers', () => {
  assert.doesNotMatch(html, /user-scalable\s*=\s*no/i);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*\.main-row\s*\{/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*td::before/);
  assert.match(client, /table-body'\)\.addEventListener\('click'/);
  assert.doesNotMatch(client, /onclick="event\.stopPropagation\(\); copyAndMark/);
  assert.doesNotMatch(client, /querySelectorAll\('\.main-row'\)\.forEach/);
});
