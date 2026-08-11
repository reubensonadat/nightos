const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/screens/manager');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const filepath = path.join(dir, file);
    let content = fs.readFileSync(filepath, 'utf8');

    // Replace tiny text with text-xs
    content = content.replace(/text-\[10px\]/g, 'text-xs');
    content = content.replace(/text-\[11px\]/g, 'text-xs');
    content = content.replace(/text-\[9px\]/g, 'text-xs');

    // Strip extreme tracking
    content = content.replace(/tracking-widest\s*/g, '');
    content = content.replace(/tracking-\[0\.\d+em\]\s*/g, '');

    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Updated ${file}`);
}