const fs = require('fs');
const path = require('path');

fs.readdirSync(__dirname)
  .filter(file => {
    const hidden = file.indexOf('.') !== 0;
    const current = file !== 'index.js';
    const type = !file.includes('.d.ts');
    return hidden && current && type;
  })
  .forEach(file => {
    /* eslint-disable global-require */
    /* eslint-disable import/no-dynamic-require */
    require(path.join(__dirname, file));
  });
