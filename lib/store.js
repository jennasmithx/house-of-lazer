const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Tiny JSON-file store. Fine for a sandbox/demo; swap for a real database
// before going live.
function read(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function write(name, rows) {
  const file = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(rows, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}

function insert(name, row) {
  const rows = read(name);
  rows.push(row);
  write(name, rows);
  return row;
}

function update(name, id, changes) {
  const rows = read(name);
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  Object.assign(row, changes);
  write(name, rows);
  return row;
}

function find(name, id) {
  return read(name).find((r) => r.id === id) || null;
}

module.exports = { read, insert, update, find };
