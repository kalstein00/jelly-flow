const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = file => {
  const {time, ...graph} = JSON.parse(fs.readFileSync(file));
  return graph;
};
assert.deepStrictEqual(read(process.argv[2]), read(process.argv[3]));
console.log('Full graph equality verified (timestamp excluded).');
