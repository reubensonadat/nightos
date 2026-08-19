const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scratch/figma_new_section.json', 'utf8'));
const node = data.nodes['42:683'].document;

function extractText(node) {
  if (node.type === 'TEXT') {
    console.log(node.characters);
  }
  if (node.children) {
    node.children.forEach(extractText);
  }
}
extractText(node);
