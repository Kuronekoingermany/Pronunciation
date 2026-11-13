function splitArticle(text) {
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('en', {granularity: 'sentence'}) : null;
  const units = [];
  for (const paragraph of text.trim().split(/\r?\n(?:[^\S\r\n]*\r?\n)+/)) {
    const sentences = segmenter
      ? Array.from(segmenter.segment(paragraph), item => item.segment)
      : paragraph.split(/(?<=[.!?])(?=\s+[A-Z])/);
    for (const [index, sentence] of sentences.entries()) {
      const separator = units.length && index === 0 ? '\n\n' : '';
      units.push({text: separator + sentence, count: tokens(sentence).length, paragraphEnd: index === sentences.length - 1});
    }
  }

  // Find the best set of boundaries for the whole article, so a short tail
  // can be rebalanced with an earlier chunk instead of being split blindly.
  const costs = new Array(units.length + 1).fill(Infinity);
  const next = new Array(units.length);
  costs[units.length] = 0;
  for (let start = units.length - 1; start >= 0; start--) {
    let count = 0;
    for (let end = start; end < units.length; end++) {
      count += units[end].count;
      if (count > 160 && end > start) break;
      const deviation = Math.max(0, 40 - count, count - 80);
      const penalty = deviation ? 1000 + deviation ** 2 : 0;
      const boundaryCost = units[end].paragraphEnd ? 0 : 18;
      const total = penalty + boundaryCost + (count - 60) ** 2 / 100 + costs[end + 1];
      if (total < costs[start]) {
        costs[start] = total;
        next[start] = end + 1;
      }
    }
  }
  const chunks = [];
  for (let start = 0; start < units.length; start = next[start]) {
    const chunk = units.slice(start, next[start]).map(unit => unit.text).join('').trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}
