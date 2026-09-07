const fs = require('node:fs')
const original = fs.readFileSync('package.json', 'utf8')
if (!original.includes('"description"')) {
  fs.writeFileSync(
    'package.json',
    original.replace('"private": true,', '"description": "Visual thinking layer for a local Zotero library",'),
  )
  console.log('description added')
}
