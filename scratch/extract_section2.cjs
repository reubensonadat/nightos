const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('scratch/figma_section2.json', 'utf8'));
  const node = data.nodes['42:417'].document;

  function toHex(color) {
    if (!color) return 'none';
    const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
    const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
    const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
    const a = color.a !== undefined ? Math.round(color.a * 255).toString(16).padStart(2, '0') : 'ff';
    return `#${r}${g}${b}${a !== 'ff' ? a : ''}`;
  }

  function printStyles(node, depth = 0) {
    const indent = '  '.repeat(depth);
    let info = `${indent}- [${node.type}] ${node.name}`;
    
    const fills = node.fills || [];
    const fillColors = fills.filter(f => f.type === 'SOLID').map(f => toHex(f.color));
    if (fillColors.length > 0) info += ` | bg: ${fillColors.join(', ')}`;
    
    if (node.type === 'TEXT') {
      const style = node.style || {};
      const size = style.fontSize;
      const weight = style.fontWeight;
      const fontFamily = style.fontFamily;
      info += ` | font: ${size}px ${weight} ${fontFamily}`;
      info += ` | text: '${node.characters.substring(0, 50).replace(/\n/g, ' ')}'`;
    }
    
    if (node.absoluteBoundingBox) {
        info += ` | w:${node.absoluteBoundingBox.width} h:${node.absoluteBoundingBox.height}`;
    }

    console.log(info);
    
    if (node.children) {
      node.children.forEach(c => printStyles(c, depth + 1));
    }
  }

  printStyles(node);
} catch (e) {
  console.error("Error:", e);
}
