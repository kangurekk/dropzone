import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "data", "dropzone.db"));

const cmd = process.argv[2] ?? "sessions";

if (cmd === "sessions") {
  console.log("\n=== Recent Plinko sessions ===");
  console.table(
    db
      .prepare(
        `SELECT username, item_name as profit, dropped_at
         FROM drop_history
         WHERE case_name = 'Plinko Session'
         ORDER BY id DESC LIMIT 10`
      )
      .all()
  );
}

if (cmd === "drops") {
  console.log("\n=== Recent drops (all) ===");
  console.table(
    db
      .prepare(
        `SELECT username, item_name, item_price, case_name
         FROM drop_history
         ORDER BY id DESC LIMIT 15`
      )
      .all()
  );
}

if (cmd === "users") {
  console.log("\n=== Users ===");
  console.table(
    db
      .prepare(
        `SELECT id, username, balance, cases_opened, is_admin
         FROM users ORDER BY id`
      )
      .all()
  );
}

if (cmd === "inventory") {
  const userId = process.argv[3] ?? "1";
  console.log(`\n=== Inventory for user ${userId} ===`);
  console.table(
    db
      .prepare(
        `SELECT id, name, price, dropped_at
         FROM inventory WHERE user_id = ?
         ORDER BY dropped_at DESC`
      )
      .all(userId)
  );
}