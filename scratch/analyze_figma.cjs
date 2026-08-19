const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('scratch/figma_data.json', 'utf8'));

  if (data.error) {
    console.log('Figma API Error:', data.error);
    process.exit(1);
  }

  const node = data.nodes['13:1217'].document;
  
  const extractedImages = [];

  function printNode(node, depth = 0) {
    const indent = '  '.repeat(depth);
    let info = `${indent}- [${node.type}] ${node.name} (ID: ${node.id})`;
    
    if (node.type === 'TEXT') {
      info += ` | Text: '${node.characters.replace(/\n/g, ' ')}'`;
    } else if (node.fills && node.fills.some(f => f.type === 'IMAGE')) {
      info += ' | Contains Image';
      extractedImages.push(node.id);
    }
    
    console.log(info);
    
    if (node.children) {
      node.children.forEach(c => printNode(c, depth + 1));
    }
  }

  console.log('--- NODE STRUCTURE ---');
  printNode(node);
  
  if (extractedImages.length > 0) {
      console.log('\n--- IMAGE NODES ---');
      console.log(extractedImages.join(', '));
  }
} catch (e) {
  console.error("Error analyzing JSON:", e);
}
