// Unmapped new-provider recognition. Frozen <=8 normalization is unchanged.
// New9–14 Source factories use the quote forms SQLite actually persists.
// Every quoted token, literal byte and SQLite token boundary remains intact.
export function normalizeFeatureStorageSql(value: string): string {
  const tokens: string[] = [];
  for (let index = 0; index < value.length;) {
    const character = value[index];
    // SQLite whitespace excludes vertical tab, NBSP and other Unicode spaces.
    if (/[ \t\n\f\r]/.test(character)) { index++; continue; }
    if (character === "'" || character === '"' || character === '`' || character === '[') {
      const start = index++, closing = character === '[' ? ']' : character;
      while (index < value.length) {
        if (value[index++] !== closing) continue;
        // SQLite bracket quoting has no doubled-closing-bracket escape.
        if (character !== '[' && value[index] === closing) { index++; continue; }
        break;
      }
      tokens.push(value.slice(start, index));
    } else if (/[A-Za-z0-9_\u0080-\uffff]/.test(character)) {
      const start = index++;
      while (index < value.length && /[A-Za-z0-9_$\u0080-\uffff]/.test(value[index])) index++;
      // SQLite folds ASCII case only. Quoted tokens never take this path.
      tokens.push(value.slice(start, index).replace(/[A-Z]/g, letter => letter.toLowerCase()));
    } else {
      const operator = ['->>', '->', '<=', '>=', '<>', '!=', '==', '||']
        .find(candidate => value.startsWith(candidate, index));
      tokens.push(operator ?? character);
      index += operator?.length ?? 1;
    }
  }
  return JSON.stringify(tokens);
}
