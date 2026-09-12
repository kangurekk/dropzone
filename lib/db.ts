import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = process.env.DATABASE_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "dropzone.db");

// Next.js ustawia NEXT_PHASE podczas zbierania page data w `next build`.
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

let _db: Database.Database | null = null;

function openDb(): Database.Database {
  if (_db) return _db;

  // turbopackIgnore sprawia, ze Turbopack nie proboje statycznie analizowac
  // tych sciezek (bez tego pakuje caly projekt do server outputa).
  if (!fs.existsSync(/* turbopackIgnore: true */ DB_DIR)) {
    fs.mkdirSync(/* turbopackIgnore: true */ DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // 1. MUSI byc przed czymkolwiek innym - daje SQLite czas na czekanie
  //    na zwolnienie locka zamiast rzucac SQLITE_BUSY od razu.
  db.pragma("busy_timeout = 10000");

  // 2. Ustaw WAL tylko jesli jeszcze nie jest WAL.
  const mode = db.pragma("journal_mode", { simple: true }) as string;
  if (mode.toLowerCase() !== "wal") {
    try {
      db.pragma("journal_mode = WAL");
    } catch {
      // Inny worker mogl przestawic miedzy naszym read a write.
    }
  }

  // 3. NIGDY nie odpalaj DDL/migracji podczas builda.
  if (!IS_BUILD) {
    runMigrations(db);
  }

  _db = db;
  return db;
}

function runMigrations(db: Database.Database) {
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        balance REAL NOT NULL DEFAULT 20,
        created_at INTEGER NOT NULL
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        name TEXT NOT NULL,
        image TEXT,
        color TEXT,
        rarity TEXT,
        price REAL NOT NULL,
        dropped_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS case_openings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        case_id TEXT NOT NULL,
        case_name TEXT NOT NULL,
        item_name TEXT NOT NULL,
        item_price REAL NOT NULL,
        opened_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        created_by INTEGER NOT NULL,
        expires_at INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS deposits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS drop_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        item_name TEXT NOT NULL,
        item_image TEXT,
        item_color TEXT,
        item_rarity TEXT,
        item_price REAL NOT NULL,
        case_name TEXT,
        case_id TEXT,
        dropped_at INTEGER NOT NULL
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS friendships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        friend_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        initiator_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(user_id, friend_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        read_at INTEGER,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_case_openings_user ON case_openings(user_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active, expires_at);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_deposits_user_time ON deposits(user_id, created_at);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_drops_time ON drop_history(dropped_at DESC);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id, status);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id, status);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_global ON messages(created_at DESC) WHERE receiver_id IS NULL;`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_dm ON messages(sender_id, receiver_id, created_at DESC);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, read_at) WHERE receiver_id IS NOT NULL;`);

    const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const has = (n: string) => cols.some((c) => c.name === n);

    const add = (col: string, ddl: string) => {
      if (!has(col)) db.exec(ddl);
    };

    add("cases_opened",    "ALTER TABLE users ADD COLUMN cases_opened INTEGER NOT NULL DEFAULT 0");
    add("highest_balance", "ALTER TABLE users ADD COLUMN highest_balance REAL NOT NULL DEFAULT 20");
    add("total_wagered",   "ALTER TABLE users ADD COLUMN total_wagered REAL NOT NULL DEFAULT 0");
    add("total_won",       "ALTER TABLE users ADD COLUMN total_won REAL NOT NULL DEFAULT 0");
    add("avatar",          "ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '◆'");
    add("banner_color",    "ALTER TABLE users ADD COLUMN banner_color TEXT NOT NULL DEFAULT '#8b5cf6'");
    add("accent_color",    "ALTER TABLE users ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#a78bfa'");
    add("bio",             "ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
    add("avatar_focal_x",  "ALTER TABLE users ADD COLUMN avatar_focal_x REAL NOT NULL DEFAULT 50");
    add("avatar_focal_y",  "ALTER TABLE users ADD COLUMN avatar_focal_y REAL NOT NULL DEFAULT 50");
    add("avatar_zoom",     "ALTER TABLE users ADD COLUMN avatar_zoom REAL NOT NULL DEFAULT 1");
    add("is_admin",        "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
  });

  migrate();
}

// Proxy - leniwie otwiera baze przy pierwszym uzyciu
const dbProxy = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const db = openDb();
    const value = (db as any)[prop];
    return typeof value === "function" ? value.bind(db) : value;
  },
});

export default dbProxy;