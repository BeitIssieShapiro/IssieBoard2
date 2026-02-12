const en = require('./keyboards/en.json');
const common = require('./keyboards/common.js');

const commonKeysets = common.keysets.map(keyset => ({
  ...keyset,
  rows: keyset.rows.map(row => ({
    ...row,
    keys: row.keys.filter(key => !key.forLanguages || key.forLanguages.includes('en'))
  }))
}));

const bottomRow = en.keysets[0].rows.find(row => row.alwaysInclude);

const mergedCommonKeysets = commonKeysets.map(keyset => ({
  ...keyset,
  rows: [...keyset.rows, bottomRow]
}));

const allKeysets = [...en.keysets, ...mergedCommonKeysets];

console.log('All keyset IDs:', allKeysets.map(k => k.id));
console.log('123 keyset rows:', allKeysets[1].rows.length);
console.log('123 keyset has bottom row:', allKeysets[1].rows[3] ? 'YES' : 'NO');
console.log('123 bottom row keys:', allKeysets[1].rows[3]?.keys?.length);
console.log('123 bottom row has keyset button:', allKeysets[1].rows[3]?.keys?.find(k => k.type === 'keyset') ? 'YES' : 'NO');