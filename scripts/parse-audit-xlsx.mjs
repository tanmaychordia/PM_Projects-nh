// Parses the manual-audit XLSX (unzip already done to /tmp/xlsx) into JSON rows.
import fs from 'node:fs'

const shared = fs.readFileSync('/tmp/xlsx/xl/sharedStrings.xml', 'utf8')
const strings = []
for (const m of shared.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1])
  strings.push(texts.join(''))
}

const sheet = fs.readFileSync('/tmp/xlsx/xl/worksheets/sheet1.xml', 'utf8')
const rows = []
for (const rm of sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const rowNum = Number(rm[1])
  const cells = []
  for (const cm of rm[2].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = cm[1]
    const ref = attrs.match(/r="([A-Z]+)\d+"/)[1]
    const type = attrs.match(/t="(\w+)"/)?.[1]
    const colLetter = ref
    const colIdx = colLetter.split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1
    let value = ''
    const inline = cm[2]?.match(/<t[^>]*>([\s\S]*?)<\/t>/)
    const v = cm[2]?.match(/<v>([\s\S]*?)<\/v>/)
    if (type === 's' && v) value = strings[Number(v[1])]
    else if (type === 'inlineStr' && inline) value = inline[1]
    else if (v) value = v[1]
    cells[colIdx] = decodeEntities(value)
  }
  rows[rowNum - 1] = cells
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
}

fs.writeFileSync('/tmp/xlsx/rows.json', JSON.stringify(rows, null, 1))
console.log('total rows:', rows.length)
console.log('header:', JSON.stringify(rows[0]))
console.log('row2 cols:', rows[1]?.length)
