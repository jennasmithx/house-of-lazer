// Minimal in-memory stand-in for the parts of supabase-js the api/ functions use.
function createFakeSupabase({ users = {} } = {}) {
  const tables = {};
  const rows = (t) => (tables[t] ??= []);

  function query(table) {
    const filters = [];
    let op = 'select';
    let payload;
    let returning = false;
    let columns = null;

    const run = () => {
      const match = (r) => filters.every((f) => f(r));
      if (op === 'insert') {
        const list = Array.isArray(payload) ? payload : [payload];
        rows(table).push(...list.map((r) => ({ ...r })));
        return { data: returning ? list : null, error: null };
      }
      if (op === 'update') {
        const hit = rows(table).filter(match);
        hit.forEach((r) => Object.assign(r, payload));
        return { data: returning ? hit.map((r) => ({ ...r })) : null, error: null };
      }
      if (op === 'delete') {
        tables[table] = rows(table).filter((r) => !match(r));
        return { data: null, error: null };
      }
      const pick = (r) => (columns ? Object.fromEntries(columns.map((c) => [c, r[c]])) : { ...r });
      return { data: rows(table).filter(match).map(pick), error: null };
    };

    const builder = {
      insert(p) { op = 'insert'; payload = p; return builder; },
      update(p) { op = 'update'; payload = p; return builder; },
      delete() { op = 'delete'; return builder; },
      select(cols = '*') {
        if (op !== 'select') returning = true;
        else if (cols !== '*') columns = cols.split(',').map((c) => c.trim());
        return builder;
      },
      eq(col, val) { filters.push((r) => r[col] === val); return builder; },
      neq(col, val) { filters.push((r) => r[col] !== val); return builder; },
      async maybeSingle() { const { data } = run(); return { data: data[0] ?? null, error: null }; },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return builder;
  }

  return {
    tables,
    from: query,
    auth: {
      async getUser(token) {
        const user = users[token];
        return user ? { data: { user }, error: null } : { data: { user: null }, error: new Error('bad token') };
      },
    },
  };
}

module.exports = { createFakeSupabase };
