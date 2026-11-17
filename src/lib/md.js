/**
 * Splits editable page text ("## heading", "- bullet", blank-line paragraphs)
 * into sections: [{ h, blocks: [{ p } | { ul }] }]. Same grammar as RichText,
 * but structured so a page can lay each section out as its own pane. Text stays
 * plain strings, so nothing typed into the admin panel can inject markup.
 */
export function parseSections(text = '') {
  const secs = [{ h: '', blocks: [] }];
  let para = [];
  let list = null;
  const cur = () => secs[secs.length - 1];
  const flushPara = () => {
    if (para.length) cur().blocks.push({ p: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (list) cur().blocks.push({ ul: list });
    list = null;
  };
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (l.startsWith('## ')) {
      flushPara();
      flushList();
      secs.push({ h: l.slice(3).trim(), blocks: [] });
    } else if (l.startsWith('- ')) {
      flushPara();
      (list ??= []).push(l.slice(2));
    } else if (!l) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(l);
    }
  }
  flushPara();
  flushList();
  return secs.filter((s) => s.h || s.blocks.length);
}

export const slug = (h) => `${(h || 'overview').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}.md`;
export const paras = (s) => s.blocks.filter((b) => b.p).map((b) => b.p);
export const bullets = (s) => s.blocks.find((b) => b.ul)?.ul ?? [];
