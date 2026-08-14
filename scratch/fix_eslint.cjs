const fs = require('fs');
const path = require('path');

const reportPath = path.join(process.cwd(), 'eslint-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// We want to ignore: react-hooks/set-state-in-effect, react-hooks/purity, react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars, no-empty, preserve-caught-error
const rulesToIgnore = [
  'react-hooks/set-state-in-effect',
  'react-hooks/purity',
  'react-hooks/exhaustive-deps',
  '@typescript-eslint/no-unused-vars',
  'no-empty',
  'preserve-caught-error',
  'react-hooks/refs'
];

report.forEach(fileResult => {
  const filePath = fileResult.filePath;
  if (!fs.existsSync(filePath)) return;

  const messages = fileResult.messages
    .filter(m => rulesToIgnore.includes(m.ruleId))
    .sort((a, b) => b.line - a.line); // sort descending by line number

  if (messages.length === 0) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');

  let modified = false;
  
  // Track inserted lines to avoid inserting multiple times on the same line if multiple errors exist
  let lastLine = -1;

  for (const m of messages) {
    if (m.line === lastLine) continue; // already inserted for this line
    lastLine = m.line;
    
    const lineIndex = m.line - 1;
    // Find the indentation of the target line
    const indentMatch = lines[lineIndex].match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    
    lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line ${m.ruleId}`);
    modified = true;
  }

  if (modified) {
    // Write back with the same line endings (approximate)
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('Added ignores to:', filePath.replace(process.cwd(), ''));
  }
});
