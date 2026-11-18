import { ESLint, Linter } from 'eslint';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const eslint = new ESLint({ cwd: root });
const results = await eslint.lintFiles(['src/**/*.js', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.mjs']);
const findings = results.flatMap(r => r.messages.map(m => ({ file: relative(r.filePath), line: m.line || 1, column: m.column || 1, severity: m.severity === 2 ? 'error' : 'warning', rule: m.ruleId || 'syntax', message: m.message })));
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const renderedIds = [];
for (const result of results.filter(r => relative(r.filePath).startsWith('src/view/'))) renderedIds.push(...[...(await readFile(result.filePath, 'utf8')).matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const knownIds = new Set([...ids, ...renderedIds]);
for (const id of new Set(ids)) if (ids.filter(x => x === id).length > 1) findings.push({ file: 'index.html', line: 1, severity: 'error', rule: 'html/unique-id', message: `중복 ID: ${id}` });
for (const match of html.matchAll(/\b(?:for|data-close)="([^"]+)"/g)) if (!ids.includes(match[1])) findings.push({ file: 'index.html', line: 1, severity: 'error', rule: 'html/id-reference', message: `대상이 없는 HTML 참조: ${match[1]}` });
const graph = new Map();
for (const result of results) {
  const text = await readFile(result.filePath, 'utf8');
  const dependencies = [];
  const collectImport = node => { if (typeof node.source?.value === 'string' && node.source.value.startsWith('.')) dependencies.push({ source: node.source.value, line: node.loc.start.line }); };
  new Linter().verify(text, [{ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' }, plugins: { inventory: { rules: { references: { create: () => ({
    ImportDeclaration: collectImport, ExportNamedDeclaration: collectImport, ExportAllDeclaration: collectImport, ImportExpression: collectImport,
    CallExpression(node) { if (relative(result.filePath) === 'src/app.js' && node.callee.name === '$' && node.arguments[0]?.type === 'Literal' && typeof node.arguments[0].value === 'string' && !knownIds.has(node.arguments[0].value)) findings.push({ file: relative(result.filePath), line: node.loc.start.line, severity: 'error', rule: 'html/js-id-reference', message: `DOM ID가 없습니다: ${node.arguments[0].value}` }); }
  }) } } } }, rules: { 'inventory/references': 'error' } }]);
  graph.set(result.filePath, dependencies.map(d => ({ ...d, target: path.resolve(path.dirname(result.filePath), d.source) })));
}
for (const [file, dependencies] of graph) for (const dependency of dependencies) {
  if (!graph.has(dependency.target)) findings.push({ file: relative(file), line: dependency.line, severity: 'error', rule: 'imports/missing-local-module', message: `검사 범위에 없는 로컬 모듈: ${dependency.source}` });
}
const visited = new Set(), active = new Set();
function visit(file, chain = []) {
  if (active.has(file)) { findings.push({ file: relative(file), line: 1, severity: 'error', rule: 'imports/cycle', message: [...chain, file].map(relative).join(' → ') }); return; }
  if (visited.has(file)) return;
  visited.add(file); active.add(file);
  for (const dependency of graph.get(file) || []) visit(dependency.target, [...chain, file]);
  active.delete(file);
}
for (const file of graph.keys()) visit(file);
const report = { generatedAtUTC: new Date().toISOString(), scope: 'src/scripts/tests/eslint config + index.html ID references', filesChecked: results.length, errors: findings.filter(f => f.severity === 'error').length, warnings: findings.filter(f => f.severity === 'warning').length, findings, limits: ['AST 정적 규칙이며 런타임 예외나 업무 판정의 정확성을 완전히 증명하지 않습니다.', 'HTML 검사는 ID 연결과 허용된 renderer 대입을 확인하며 템플릿 전체의 데이터 흐름을 증명하지 않습니다.', '실제 CSV 시점/수치/요약 정확성은 npm test 및 별도 QA로 검증합니다.'] };
const basename = process.argv.includes('--before') ? 'STATIC_CHECK_BEFORE' : 'STATIC_CHECK_REPORT';
await mkdir(new URL('../deliverables/', import.meta.url), { recursive: true });
await writeFile(new URL(`../deliverables/${basename}.json`, import.meta.url), JSON.stringify(report, null, 2));
const lines = ['# 정적검사 실행 결과', '', `생성(UTC): ${report.generatedAtUTC}`, `검사 JavaScript 파일 ${report.filesChecked}개 · 오류 ${report.errors} · 경고 ${report.warnings}`, '', '| 파일:행 | 규칙 | 결과 |', '|---|---|---|', ...findings.map(f => `| ${f.file}:${f.line} | ${f.rule} | ${f.message.replaceAll('|', '/')} |`), '', '## 범위와 한계', '', ...report.limits.map(s => '- ' + s)];
await writeFile(new URL(`../deliverables/${basename}.md`, import.meta.url), lines.join('\n'));
for (const f of findings) console.log(`${f.severity}: ${f.file}:${f.line} ${f.rule}: ${f.message}`);
console.log(`Static check: ${report.filesChecked} files, ${report.errors} errors, ${report.warnings} warnings`);
if (report.errors || report.warnings) process.exitCode = 1;
