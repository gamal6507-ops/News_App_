const { XMLParser } = require('fast-xml-parser');

// Reuse the feed parser's HTML entity tables, without interpreting feed text as XML markup.
const entityParser = new XMLParser({ parseTagValue: false, trimValues: false, htmlEntities: true });

function plainText(value) {
  let result = typeof value === 'string' ? value : '';
  // Publishers sometimes HTML-escape text before RSS escapes it a second time.
  for (let pass = 0; pass < 3 && result.includes('&'); pass++) {
    const decoded = entityParser.parse(`<text>${result.replace(/</g, '&lt;')}</text>`).text;
    if (typeof decoded !== 'string' || decoded === result) break;
    result = decoded;
  }
  return result.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = { plainText };
