const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = ['auth.js', 'buyer.js', 'farmer.js', 'orders.js', 'analytics.js'];

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(
    /require\('\.\.\/database\/pool'\)/g,
    "require('../database/pool-sqlite')"
  );
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated ${file}`);
});

console.log('\n✅ All routes updated to use SQLite!');
