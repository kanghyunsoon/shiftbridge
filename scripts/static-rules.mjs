import path from 'node:path';

const normalize = value => value.replaceAll('\\', '/');
const propertyName = node => node?.type === 'MemberExpression' ? node.computed ? node.property.value : node.property.name : null;
function importedRenderer(context, node) {
  if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') return false;
  for (let scope = context.sourceCode.getScope(node); scope; scope = scope.upper) {
    const variable = scope.variables.find(v => v.name === node.callee.name);
    if (!variable) continue;
    return variable.defs.some(def => def.type === 'ImportBinding' && def.parent.source.value === './view/render.js' && ['renderDashboard', 'renderDetail'].includes(def.node.imported?.name));
  }
  return false;
}
const rule = (message, create) => ({ meta: { type: 'problem', schema: [], messages: { violation: message } }, create });
export const rules = {
  'layer-boundaries': rule('허용되지 않은 계층 의존성 또는 외부 모듈입니다: {{target}}', context => {
    const file = normalize(context.filename);
    const zone = file.includes('/src/domain/') ? 'domain' : file.includes('/src/data/') ? 'data' : file.includes('/src/view/') ? 'view' : null;
    const check = node => {
      const source = node.source;
      if (!source) return;
      const name = source.value;
      if (typeof name !== 'string') { context.report({ node, messageId: 'violation', data: { target: '동적 import 경로' } }); return; }
      if (!name.startsWith('.')) { context.report({ node, messageId: 'violation', data: { target: name } }); return; }
      const target = normalize(path.resolve(path.dirname(context.filename), name));
      const allowed = !zone ? target.includes('/src/') : zone === 'view' ? target.includes('/src/view/') || target.includes('/src/domain/') : target.includes(`/src/${zone}/`);
      if (!allowed) context.report({ node, messageId: 'violation', data: { target: name } });
    };
    return { ImportDeclaration: check, ExportNamedDeclaration: check, ExportAllDeclaration: check, ImportExpression: check };
  }),
  'explicit-clock': rule('업무 판정은 현재 시각을 직접 조회하지 말고 명시적 입력 시각을 사용해야 합니다.', context => ({
    CallExpression(node) { if (node.callee.object?.name === 'Date' && propertyName(node.callee) === 'now') context.report({ node, messageId: 'violation' }); },
    NewExpression(node) { if (node.callee.name === 'Date' && node.arguments.length === 0) context.report({ node, messageId: 'violation' }); }
  })),
  'trusted-html': rule('HTML 대입은 검토된 renderer 반환값 또는 빈 문자열만 허용합니다. 입력값은 textContent/value를 사용하세요.', context => ({
    AssignmentExpression(node) {
      if (!['innerHTML', 'outerHTML'].includes(propertyName(node.left))) return;
      if (propertyName(node.left) === 'innerHTML' && ((node.right.type === 'Literal' && node.right.value === '') || importedRenderer(context, node.right))) return;
      context.report({ node, messageId: 'violation' });
    },
    CallExpression(node) { if (propertyName(node.callee) === 'insertAdjacentHTML') context.report({ node, messageId: 'violation' }); }
  })),
  'bounded-call-arguments': rule('큰 CSV 배열을 Math.max/min 인자로 펼치면 호출 스택 제한에 걸릴 수 있습니다. reduce/반복문을 사용하세요.', context => ({
    CallExpression(node) {
      if (node.callee.object?.name === 'Math' && ['max', 'min'].includes(propertyName(node.callee)) && node.arguments.some(a => a.type === 'SpreadElement')) context.report({ node, messageId: 'violation' });
    }
  })),
  'event-error-boundary': rule('브라우저 이벤트는 Promise를 기다리지 않습니다. 동기 리스너에서 비동기 작업을 호출하고 catch로 실패를 처리하세요.', context => {
    const asyncFunctions = new Set();
    const listeners = [];
    return {
      FunctionDeclaration(node) { if (node.async && node.id) asyncFunctions.add(node.id.name); },
      VariableDeclarator(node) { if (node.init?.async && node.id.type === 'Identifier') asyncFunctions.add(node.id.name); },
      CallExpression(node) { if (propertyName(node.callee) === 'addEventListener') listeners.push(node); },
      'Program:exit'() {
        for (const node of listeners) {
          const handler = node.arguments[1];
          if (handler?.async || (handler?.type === 'Identifier' && asyncFunctions.has(handler.name))) context.report({ node: handler, messageId: 'violation' });
        }
      }
    };
  })
};

export default { rules };
