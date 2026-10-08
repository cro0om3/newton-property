import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getSettings } from "./settings";
import { zonedDayRange } from "./time";
import type { CardExtra, CardFilters, CardRow, ChatRow, DeveloperRow, ExtractedCard, MessageRow, SupplierRow } from "./types";

const globalForDb = globalThis as unknown as { propertyDeskDb?: DatabaseSync };

function dataDir() {
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  mkdirSync(path.join(dir, "media"), { recursive: true });
  mkdirSync(path.join(dir, "wa-session"), { recursive: true });
  return dir;
}

export function mediaDir() {
  return path.join(dataDir(), "media");
}

export function sessionDir() {
  return path.join(dataDir(), "wa-session");
}

function openDb() {
  const database = new DatabaseSync(path.join(dataDir(), "app.db"));
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS chats (
      jid TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      is_group INTEGER NOT NULL DEFAULT 0,
      last_message_at INTEGER,
      last_preview TEXT
    );
    CREATE TABLE IF NOT EXISTS contacts (
      jid TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_jid TEXT NOT NULL,
      sender_name TEXT,
      sender_phone TEXT,
      from_me INTEGER NOT NULL DEFAULT 0,
      body TEXT,
      message_type TEXT NOT NULL,
      media_file TEXT,
      media_mime TEXT,
      latitude REAL,
      longitude REAL,
      timestamp INTEGER NOT NULL,
      processed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_jid, timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_processed ON messages(processed, chat_jid);
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      chat_jid TEXT NOT NULL,
      sender_name TEXT,
      sender_phone TEXT,
      kind TEXT NOT NULL,
      purpose TEXT,
      property_type TEXT,
      title TEXT,
      city TEXT,
      area TEXT,
      price REAL,
      currency TEXT,
      bedrooms INTEGER,
      bathrooms INTEGER,
      size_sqm REAL,
      summary TEXT,
      confidence REAL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_cards_chat ON cards(chat_jid);
    CREATE TABLE IF NOT EXISTS card_messages (
      card_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      PRIMARY KEY (card_id, message_id)
    );
  `);
  ensureColumns(database);
  return database;
}

function ensureColumns(database: DatabaseSync) {
  const columns = database.prepare("PRAGMA table_info(cards)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "extra")) {
    database.exec("ALTER TABLE cards ADD COLUMN extra TEXT");
  }
  if (!columns.some((column) => column.name === "broker")) {
    database.exec("ALTER TABLE cards ADD COLUMN broker TEXT");
  }
  if (!columns.some((column) => column.name === "next_follow_up")) {
    database.exec("ALTER TABLE cards ADD COLUMN next_follow_up INTEGER");
  }
  if (!columns.some((column) => column.name === "supplier_id")) {
    database.exec("ALTER TABLE cards ADD COLUMN supplier_id TEXT");
  }
  const chatColumns = database.prepare("PRAGMA table_info(chats)").all() as Array<{ name: string }>;
  if (!chatColumns.some((column) => column.name === "name_locked")) {
    database.exec("ALTER TABLE chats ADD COLUMN name_locked INTEGER NOT NULL DEFAULT 0");
  }
  if (!chatColumns.some((column) => column.name === "avatar")) {
    database.exec("ALTER TABLE chats ADD COLUMN avatar TEXT");
  }
  const outboxReady = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'outbox'").get();
  if (outboxReady) {
    const outboxColumns = database.prepare("PRAGMA table_info(outbox)").all() as Array<{ name: string }>;
    if (!outboxColumns.some((column) => column.name === "media_file")) {
      database.exec("ALTER TABLE outbox ADD COLUMN media_file TEXT");
    }
    if (!outboxColumns.some((column) => column.name === "media_mime")) {
      database.exec("ALTER TABLE outbox ADD COLUMN media_mime TEXT");
    }
  }
  database.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      company_id TEXT,
      chat_jid TEXT UNIQUE,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      chat_jid TEXT NOT NULL,
      body TEXT NOT NULL,
      media_file TEXT,
      media_mime TEXT,
      status TEXT NOT NULL,
      error TEXT,
      created_at INTEGER NOT NULL,
      sent_at INTEGER,
      not_before INTEGER
    );
    CREATE TABLE IF NOT EXISTS follow_ups (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      note TEXT NOT NULL,
      broker TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS desk_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      value TEXT NOT NULL
    );
  `);
  const companyColumns = database.prepare("PRAGMA table_info(companies)").all() as Array<{ name: string }>;
  if (companyColumns.length && !companyColumns.some((column) => column.name === "logo")) {
    database.exec("ALTER TABLE companies ADD COLUMN logo TEXT");
  }
  const outboxColumns = database.prepare("PRAGMA table_info(outbox)").all() as Array<{ name: string }>;
  if (outboxColumns.length && !outboxColumns.some((column) => column.name === "not_before")) {
    database.exec("ALTER TABLE outbox ADD COLUMN not_before INTEGER");
  }
}

export function getDb() {
  if (!globalForDb.propertyDeskDb) globalForDb.propertyDeskDb = openDb();
  ensureColumns(globalForDb.propertyDeskDb);
  return globalForDb.propertyDeskDb;
}

const CARD_SELECT = `
  SELECT c.*,
    COALESCE(
      (
        SELECT m.media_file FROM card_messages cm
        JOIN messages m ON m.id = cm.message_id
        WHERE cm.card_id = c.id AND m.media_file IS NOT NULL AND m.message_type = 'image'
        ORDER BY m.timestamp ASC
        LIMIT 1
      ),
      (
        SELECT REPLACE(m.media_file, '.pdf', '-cover.jpg') FROM card_messages cm
        JOIN messages m ON m.id = cm.message_id
        WHERE cm.card_id = c.id AND m.media_file LIKE '%.pdf'
        ORDER BY m.timestamp DESC
        LIMIT 1
      )
    ) AS cover
  FROM cards c
`;

export function upsertContact(jid: string, name: string | null, phone: string | null) {
  getDb()
    .prepare(
      `INSERT INTO contacts (jid, name, phone) VALUES (?, ?, ?)
       ON CONFLICT(jid) DO UPDATE SET
         name = COALESCE(excluded.name, contacts.name),
         phone = COALESCE(excluded.phone, contacts.phone)`,
    )
    .run(jid, name, phone);
}

export function clearLidPhones() {
  getDb().exec(`
    UPDATE chats SET phone = NULL
    WHERE jid LIKE '%@lid' AND phone = '+' || substr(jid, 1, instr(jid, '@') - 1);
    UPDATE contacts SET phone = NULL
    WHERE jid LIKE '%@lid' AND phone = '+' || substr(jid, 1, instr(jid, '@') - 1);
    UPDATE messages SET sender_phone = NULL
    WHERE chat_jid LIKE '%@lid'
      AND sender_phone = '+' || substr(chat_jid, 1, instr(chat_jid, '@') - 1);
    UPDATE cards SET sender_phone = NULL
    WHERE chat_jid LIKE '%@lid'
      AND sender_phone = '+' || substr(chat_jid, 1, instr(chat_jid, '@') - 1);
  `);
}

export function listPrivateLids() {
  return getDb().prepare("SELECT jid, is_group FROM chats WHERE jid LIKE '%@lid' AND is_group = 0").all() as Array<{
    jid: string;
    is_group: number;
  }>;
}

export function rememberPhone(jid: string, phone: string) {
  if (!phone || jid.endsWith("@g.us")) return;
  const db = getDb();
  db.prepare("UPDATE chats SET phone = ? WHERE jid = ?").run(phone, jid);
  db.prepare(
    `INSERT INTO contacts (jid, name, phone) VALUES (?, NULL, ?)
     ON CONFLICT(jid) DO UPDATE SET phone = excluded.phone`,
  ).run(jid, phone);
  db.prepare("UPDATE messages SET sender_phone = ? WHERE chat_jid = ? AND from_me = 0").run(phone, jid);
  db.prepare("UPDATE cards SET sender_phone = ? WHERE chat_jid = ?").run(phone, jid);
}

export function renameChat(jid: string, name: string) {
  const clean = name.trim();
  if (!clean) return false;
  const db = getDb();
  const row = db.prepare("SELECT is_group FROM chats WHERE jid = ?").get(jid) as { is_group: number } | undefined;
  if (!row) return false;
  db.prepare("UPDATE chats SET name = ?, name_locked = 1 WHERE jid = ?").run(clean, jid);
  db.prepare(
    `INSERT INTO contacts (jid, name, phone) VALUES (?, ?, NULL)
     ON CONFLICT(jid) DO UPDATE SET name = excluded.name`,
  ).run(jid, clean);
  if (!row.is_group) {
    db.prepare("UPDATE messages SET sender_name = ? WHERE chat_jid = ? AND from_me = 0").run(clean, jid);
    db.prepare("UPDATE cards SET sender_name = ? WHERE chat_jid = ?").run(clean, jid);
    db.prepare("UPDATE suppliers SET name = ? WHERE chat_jid = ?").run(clean, jid);
  }
  return true;
}

export function ensureSupplier(chatJid: string, name: string | null, phone: string | null) {
  if (!chatJid || chatJid === "desk") return null;
  const db = getDb();
  const existing = db.prepare("SELECT id, name, phone FROM suppliers WHERE chat_jid = ?").get(chatJid) as
    | { id: string; name: string; phone: string | null }
    | undefined;
  if (existing) {
    if (phone && !existing.phone) db.prepare("UPDATE suppliers SET phone = ? WHERE id = ?").run(phone, existing.id);
    db.prepare("UPDATE cards SET supplier_id = ? WHERE chat_jid = ? AND supplier_id IS NULL").run(existing.id, chatJid);
    return getSupplier(existing.id);
  }
  const id = randomUUID();
  db.prepare("INSERT INTO suppliers (id, name, phone, company_id, chat_jid, created_at) VALUES (?, ?, ?, NULL, ?, ?)").run(
    id,
    name?.trim() || "Unnamed supplier",
    phone,
    chatJid,
    Date.now(),
  );
  db.prepare("UPDATE cards SET supplier_id = ? WHERE chat_jid = ? AND supplier_id IS NULL").run(id, chatJid);
  return getSupplier(id);
}

export function getSupplier(id: string) {
  return (
    (getDb()
      .prepare(
        `SELECT s.id, s.name, s.phone, s.company_id, s.chat_jid, c.name AS company_name, c.logo AS company_logo,
          (SELECT COUNT(*) FROM cards k WHERE k.supplier_id = s.id AND k.kind = 'listing') AS listings
         FROM suppliers s LEFT JOIN companies c ON c.id = s.company_id WHERE s.id = ?`,
      )
      .get(id) as SupplierRow | undefined) || null
  );
}

export function listSuppliers() {
  const sources = getDb()
    .prepare("SELECT chat_jid, MAX(sender_name) AS sender_name, MAX(sender_phone) AS sender_phone FROM cards WHERE chat_jid != 'desk' GROUP BY chat_jid")
    .all() as Array<{ chat_jid: string; sender_name: string | null; sender_phone: string | null }>;
  for (const source of sources) ensureSupplier(source.chat_jid, source.sender_name, source.sender_phone);
  return getDb()
    .prepare(
      `SELECT s.id, s.name, s.phone, s.company_id, s.chat_jid, c.name AS company_name, c.logo AS company_logo,
        (SELECT COUNT(*) FROM cards k WHERE k.supplier_id = s.id AND k.kind = 'listing') AS listings
       FROM suppliers s
       LEFT JOIN companies c ON c.id = s.company_id
       ORDER BY COALESCE(c.name, 'zzz'), s.name`,
    )
    .all() as SupplierRow[];
}

function companyIdFor(name: string) {
  const company = name.trim();
  if (!company) return null;
  const db = getDb();
  const found = db.prepare("SELECT id FROM companies WHERE name = ? COLLATE NOCASE").get(company) as { id: string } | undefined;
  if (found) return found.id;
  const id = randomUUID();
  db.prepare("INSERT INTO companies (id, name, created_at) VALUES (?, ?, ?)").run(id, company, Date.now());
  return id;
}

export function listDevelopers() {
  return getDb()
    .prepare(
      `SELECT c.id, c.name, c.logo,
        (SELECT COUNT(*) FROM suppliers s WHERE s.company_id = c.id) AS employees,
        (SELECT COUNT(*) FROM cards k JOIN suppliers s ON s.id = k.supplier_id WHERE s.company_id = c.id AND k.kind = 'listing') AS listings
       FROM companies c
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all() as DeveloperRow[];
}

export function getDeveloper(id: string) {
  return (
    (getDb()
      .prepare(
        `SELECT c.id, c.name, c.logo,
          (SELECT COUNT(*) FROM suppliers s WHERE s.company_id = c.id) AS employees,
          (SELECT COUNT(*) FROM cards k JOIN suppliers s ON s.id = k.supplier_id WHERE s.company_id = c.id AND k.kind = 'listing') AS listings
         FROM companies c WHERE c.id = ?`,
      )
      .get(id) as DeveloperRow | undefined) || null
  );
}

export function createDeveloper(name: string) {
  return companyIdFor(name);
}

export function setDeveloperLogo(id: string, file: string) {
  const result = getDb().prepare("UPDATE companies SET logo = ? WHERE id = ?").run(file, id);
  return result.changes > 0;
}

export function renameDeveloper(id: string, name: string) {
  const clean = name.trim();
  if (!clean) return null;
  const db = getDb();
  const current = db.prepare("SELECT id FROM companies WHERE id = ?").get(id);
  if (!current) return null;
  const other = db.prepare("SELECT id FROM companies WHERE name = ? COLLATE NOCASE AND id != ?").get(clean, id) as { id: string } | undefined;
  if (other) {
    db.prepare("UPDATE suppliers SET company_id = ? WHERE company_id = ?").run(other.id, id);
    db.prepare("DELETE FROM companies WHERE id = ?").run(id);
    return other.id;
  }
  db.prepare("UPDATE companies SET name = ? WHERE id = ?").run(clean, id);
  return id;
}

export function updateEmployee(id: string, name: string, developerName: string) {
  const supplier = getSupplier(id);
  if (!supplier) return false;
  if (!saveSupplier(id, name, developerName)) return false;
  if (supplier.chat_jid) renameChat(supplier.chat_jid, name.trim());
  return true;
}

export function listPrivateChats() {
  return getDb()
    .prepare("SELECT jid, name, phone FROM chats WHERE is_group = 0 ORDER BY COALESCE(name, phone)")
    .all() as Array<{ jid: string; name: string | null; phone: string | null }>;
}

export function listDeveloperNames() {
  return (getDb().prepare("SELECT name FROM companies ORDER BY name COLLATE NOCASE").all() as Array<{ name: string }>).map((row) => row.name);
}

export function assignChatDeveloper(jid: string, personName: string, developerName: string) {
  const chat = getDb().prepare("SELECT name, phone FROM chats WHERE jid = ?").get(jid) as { name: string | null; phone: string | null } | undefined;
  if (!chat) return false;
  const name = personName.trim() || chat.name || "Unnamed";
  if (personName.trim()) renameChat(jid, personName.trim());
  const supplier = ensureSupplier(jid, name, chat.phone);
  if (!supplier) return false;
  return saveSupplier(supplier.id, name, developerName);
}

export function linkSupplier(cardId: string, name: string, companyName: string) {
  const card = getCard(cardId);
  if (!card) return false;
  const linked = ensureSupplier(card.chat_jid, card.sender_name, card.sender_phone);
  const supplier = linked || (card.supplier_id ? getSupplier(card.supplier_id) : null);
  if (supplier) return saveSupplier(supplier.id, name, companyName);
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO suppliers (id, name, phone, company_id, chat_jid, created_at) VALUES (?, ?, ?, ?, NULL, ?)")
    .run(id, name.trim(), card.sender_phone, companyIdFor(companyName), Date.now());
  getDb().prepare("UPDATE cards SET supplier_id = ?, sender_name = ?, updated_at = ? WHERE id = ?").run(id, name.trim(), Date.now(), cardId);
  return true;
}

export function saveSupplier(id: string, name: string, companyName: string) {
  const cleanName = name.trim();
  if (!cleanName) return false;
  const db = getDb();
  const row = db.prepare("SELECT id FROM suppliers WHERE id = ?").get(id);
  if (!row) return false;
  let companyId: string | null = null;
  const company = companyName.trim();
  if (company) {
    const found = db.prepare("SELECT id FROM companies WHERE name = ? COLLATE NOCASE").get(company) as { id: string } | undefined;
    companyId = found?.id || randomUUID();
    if (!found) db.prepare("INSERT INTO companies (id, name, created_at) VALUES (?, ?, ?)").run(companyId, company, Date.now());
  }
  db.prepare("UPDATE suppliers SET name = ?, company_id = ? WHERE id = ?").run(cleanName, companyId, id);
  db.prepare("UPDATE cards SET sender_name = ? WHERE supplier_id = ?").run(cleanName, id);
  return true;
}

export function updateCardDetails(
  id: string,
  input: {
    title?: string;
    city?: string | null;
    area?: string | null;
    price?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    sizeSqm?: number | null;
    propertyType?: string | null;
    purpose?: string | null;
    extra?: Partial<CardExtra>;
  },
) {
  const current = getCard(id);
  if (!current) return false;
  let extra: CardExtra = {};
  try {
    extra = current.extra ? (JSON.parse(current.extra) as CardExtra) : {};
  } catch {
    extra = {};
  }
  const nextExtra = { ...extra, ...input.extra };
  getDb()
    .prepare(
      `UPDATE cards SET title = ?, city = ?, area = ?, price = ?, bedrooms = ?, bathrooms = ?, size_sqm = ?,
        property_type = ?, purpose = ?, extra = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      input.title?.trim() || current.title,
      input.city ?? current.city,
      input.area ?? current.area,
      input.price === undefined ? current.price : input.price,
      input.bedrooms === undefined ? current.bedrooms : input.bedrooms,
      input.bathrooms === undefined ? current.bathrooms : input.bathrooms,
      input.sizeSqm === undefined ? current.size_sqm : input.sizeSqm,
      input.propertyType ?? current.property_type,
      input.purpose ?? current.purpose,
      JSON.stringify(nextExtra),
      Date.now(),
      id,
    );
  return true;
}

export function contactName(jid: string) {
  const row = getDb().prepare("SELECT name FROM contacts WHERE jid = ?").get(jid) as { name: string | null } | undefined;
  return row?.name || null;
}

export function upsertChat(input: {
  jid: string;
  name?: string | null;
  phone?: string | null;
  isGroup: boolean;
  lastMessageAt?: number | null;
  lastPreview?: string | null;
}) {
  getDb()
    .prepare(
      `INSERT INTO chats (jid, name, phone, is_group, last_message_at, last_preview)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(jid) DO UPDATE SET
         name = CASE WHEN chats.name_locked = 1 THEN chats.name ELSE COALESCE(excluded.name, chats.name) END,
         phone = COALESCE(excluded.phone, chats.phone),
         is_group = excluded.is_group,
         last_message_at = CASE
           WHEN excluded.last_message_at IS NULL THEN chats.last_message_at
           WHEN chats.last_message_at IS NULL THEN excluded.last_message_at
           ELSE MAX(chats.last_message_at, excluded.last_message_at)
         END,
         last_preview = CASE
           WHEN excluded.last_message_at IS NOT NULL AND excluded.last_message_at >= IFNULL(chats.last_message_at, 0)
           THEN excluded.last_preview ELSE chats.last_preview END`,
    )
    .run(
      input.jid,
      input.name ?? null,
      input.phone ?? null,
      input.isGroup ? 1 : 0,
      input.lastMessageAt ?? null,
      input.lastPreview ?? null,
    );
}

export function insertMessage(message: Omit<MessageRow, "created_at">) {
  const result = getDb()
    .prepare(
      `INSERT OR IGNORE INTO messages (
        id, chat_jid, sender_name, sender_phone, from_me, body, message_type,
        media_file, media_mime, latitude, longitude, timestamp, processed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      message.id,
      message.chat_jid,
      message.sender_name,
      message.sender_phone,
      message.from_me,
      message.body,
      message.message_type,
      message.media_file,
      message.media_mime,
      message.latitude,
      message.longitude,
      message.timestamp,
      message.processed,
      Date.now(),
    );
  return result.changes > 0;
}

export function updateMessageBody(id: string, body: string) {
  getDb().prepare("UPDATE messages SET body = ? WHERE id = ?").run(body, id);
}

export function setChatAvatar(jid: string, file: string) {
  getDb().prepare("UPDATE chats SET avatar = ? WHERE jid = ?").run(file, jid);
}

export function chatsMissingAvatars() {
  return getDb().prepare("SELECT jid FROM chats WHERE avatar IS NULL OR TRIM(avatar) = ''").all() as Array<{ jid: string }>;
}

export function listUnnamedGroups() {
  return getDb()
    .prepare("SELECT jid FROM chats WHERE is_group = 1 AND (name IS NULL OR TRIM(name) = '')")
    .all() as Array<{ jid: string }>;
}

export function listChats() {
  return getDb()
    .prepare(
      `SELECT c.*, co.name AS company_name, co.logo AS company_logo,
        (SELECT COUNT(*) FROM cards k WHERE k.chat_jid = c.jid AND k.kind = 'listing' AND k.status != 'closed') AS listings
       FROM chats c
       LEFT JOIN suppliers s ON s.chat_jid = c.jid
       LEFT JOIN companies co ON co.id = s.company_id
       ORDER BY c.last_message_at DESC`,
    )
    .all() as ChatRow[];
}

export function listMessages(chatJid: string) {
  return getDb()
    .prepare(
      `SELECT * FROM (
         SELECT * FROM messages WHERE chat_jid = ? ORDER BY timestamp DESC LIMIT 800
       ) ORDER BY timestamp ASC`,
    )
    .all(chatJid) as MessageRow[];
}

export function listUnprocessed(chatJid?: string) {
  if (chatJid) {
    return getDb()
      .prepare(
        "SELECT * FROM messages WHERE chat_jid = ? AND processed = 0 ORDER BY timestamp ASC LIMIT 25",
      )
      .all(chatJid) as MessageRow[];
  }
  return getDb()
    .prepare("SELECT DISTINCT chat_jid FROM messages WHERE processed = 0 LIMIT 40")
    .all() as { chat_jid: string }[];
}

export function recentContext(chatJid: string) {
  const rows = getDb()
    .prepare("SELECT * FROM messages WHERE chat_jid = ? ORDER BY timestamp DESC LIMIT 30")
    .all(chatJid) as MessageRow[];
  return rows.reverse();
}

export function markProcessed(ids: string[]) {
  if (!ids.length) return;
  const statement = getDb().prepare("UPDATE messages SET processed = 1 WHERE id = ?");
  for (const id of ids) statement.run(id);
}

export function openCards(chatJid: string) {
  return getDb()
    .prepare(
      `${CARD_SELECT} WHERE c.chat_jid = ? AND c.status != 'closed' ORDER BY c.updated_at DESC LIMIT 8`,
    )
    .all(chatJid) as CardRow[];
}

export function listCards(filters: CardFilters = {}) {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (filters.kind && ["listing", "inquiry"].includes(filters.kind)) {
    where.push("c.kind = ?");
    params.push(filters.kind);
  }
  if (
    filters.propertyType &&
    ["villa", "apartment", "land", "office", "warehouse", "townhouse", "building", "other"].includes(
      filters.propertyType,
    )
  ) {
    where.push("c.property_type = ?");
    params.push(filters.propertyType);
  }
  if (filters.purpose && ["sale", "rent", "buy", "seek_rent"].includes(filters.purpose)) {
    where.push("c.purpose = ?");
    params.push(filters.purpose);
  }
  if (filters.status && ["new", "contacted", "viewing", "offer", "closed", "needs_review"].includes(filters.status)) {
    where.push("c.status = ?");
    params.push(filters.status);
  }
  if (filters.supplierId) {
    where.push("c.supplier_id = ?");
    params.push(filters.supplierId);
  }
  if (filters.developerId) {
    where.push("c.supplier_id IN (SELECT id FROM suppliers WHERE company_id = ?)");
    params.push(filters.developerId);
  }
  if (filters.q?.trim()) {
    const like = `%${filters.q.trim().replace(/[%_]/g, "")}%`;
    where.push(
      "(c.title LIKE ? OR c.summary LIKE ? OR c.area LIKE ? OR c.city LIKE ? OR c.sender_name LIKE ? OR c.sender_phone LIKE ?)",
    );
    params.push(like, like, like, like, like, like);
  }
  const limit = Math.min(Math.max(filters.limit || 300, 1), 300);
  const sql = `${CARD_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY c.updated_at DESC LIMIT ${limit}`;
  return getDb().prepare(sql).all(...params) as CardRow[];
}

export function cardGallery(messages: MessageRow[]) {
  const files: string[] = [];
  for (const message of messages) {
    if (message.message_type === "image" && message.media_file) files.push(message.media_file);
    if (!message.media_file?.toLowerCase().endsWith(".pdf")) continue;
    const base = message.media_file.replace(/\.pdf$/i, "");
    const cover = `${base}-cover.jpg`;
    if (existsSync(path.join(mediaDir(), cover))) files.push(cover);
    for (let page = 2; page <= 24; page += 1) {
      const name = `${base}-p${page}.jpg`;
      if (!existsSync(path.join(mediaDir(), name))) break;
      files.push(name);
    }
  }
  return [...new Set(files)];
}

export function getCard(id: string) {
  return (
    (getDb().prepare(`${CARD_SELECT} WHERE c.id = ?`).get(id) as CardRow | undefined) || null
  );
}

export function cardMessages(cardId: string) {
  return getDb()
    .prepare(
      `SELECT m.* FROM card_messages cm
       JOIN messages m ON m.id = cm.message_id
       WHERE cm.card_id = ?
       ORDER BY m.timestamp ASC`,
    )
    .all(cardId) as MessageRow[];
}

function statusFor(item: ExtractedCard) {
  const settings = getSettings();
  const missingPrice = settings.reviewIfMissingPrice && item.price == null;
  const missingLocation = settings.reviewIfMissingLocation && !item.city && !item.area;
  if (item.needs_review || item.confidence < settings.reviewConfidence || missingPrice || missingLocation) return "needs_review";
  return "new";
}

function keep<T>(next: T | null | undefined, previous: T | null) {
  return next === null || next === undefined || next === "" ? previous : next;
}

export function saveExtractedCard(input: {
  chatJid: string;
  senderName: string | null;
  senderPhone: string | null;
  messageIds: string[];
  item: ExtractedCard;
}) {
  const db = getDb();
  const now = Date.now();
  const existing =
    input.item.match_card_id && input.item.match_card_id !== "null"
      ? getCard(input.item.match_card_id)
      : null;
  const sameChat = existing && existing.chat_jid === input.chatJid ? existing : null;
  const nextStatus = statusFor(input.item);
  let cardId: string;

  if (!sameChat) {
    cardId = randomUUID();
    db.prepare(
      `INSERT INTO cards (
        id, chat_jid, sender_name, sender_phone, kind, purpose, property_type, title,
        city, area, price, currency, bedrooms, bathrooms, size_sqm, summary, confidence,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      cardId,
      input.chatJid,
      input.senderName,
      input.senderPhone,
      input.item.kind,
      input.item.purpose,
      input.item.property_type,
      input.item.title,
      input.item.city,
      input.item.area,
      input.item.price,
      input.item.currency || getSettings().currency,
      input.item.bedrooms,
      input.item.bathrooms,
      input.item.size_sqm,
      input.item.summary,
      input.item.confidence,
      nextStatus,
      now,
      now,
    );
  } else {
    cardId = sameChat.id;
    const locked = ["contacted", "viewing", "offer", "closed"].includes(sameChat.status);
    db.prepare(
      `UPDATE cards SET
        sender_name = COALESCE(?, sender_name),
        sender_phone = COALESCE(?, sender_phone),
        kind = ?,
        purpose = ?,
        property_type = ?,
        title = ?,
        city = ?,
        area = ?,
        price = ?,
        currency = ?,
        bedrooms = ?,
        bathrooms = ?,
        size_sqm = ?,
        summary = ?,
        confidence = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?`,
    ).run(
      input.senderName,
      input.senderPhone,
      input.item.kind,
      input.item.purpose,
      input.item.property_type,
      keep(input.item.title, sameChat.title),
      keep(input.item.city, sameChat.city),
      keep(input.item.area, sameChat.area),
      input.item.price ?? sameChat.price,
      input.item.currency || sameChat.currency || getSettings().currency,
      input.item.bedrooms ?? sameChat.bedrooms,
      input.item.bathrooms ?? sameChat.bathrooms,
      input.item.size_sqm ?? sameChat.size_sqm,
      input.item.summary || sameChat.summary,
      input.item.confidence,
      locked ? sameChat.status : nextStatus,
      now,
      sameChat.id,
    );
  }

  const link = db.prepare("INSERT OR IGNORE INTO card_messages (card_id, message_id) VALUES (?, ?)");
  for (const messageId of input.messageIds) link.run(cardId, messageId);
  return cardId;
}

const STATUSES = ["new", "contacted", "viewing", "offer", "closed", "needs_review"];

export function updateCardStatus(id: string, status: string) {
  if (!STATUSES.includes(status)) return false;
  const result = getDb()
    .prepare("UPDATE cards SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, Date.now(), id);
  return result.changes > 0;
}

export function updateCardDesk(id: string, input: { broker?: string | null; nextFollowUp?: number | null }) {
  const current = getCard(id);
  if (!current) return false;
  getDb()
    .prepare("UPDATE cards SET broker = ?, next_follow_up = ?, updated_at = ? WHERE id = ?")
    .run(
      input.broker === undefined ? current.broker : input.broker || null,
      input.nextFollowUp === undefined ? current.next_follow_up : input.nextFollowUp,
      Date.now(),
      id,
    );
  return true;
}

export function deleteCard(id: string) {
  const db = getDb();
  if (!db.prepare("SELECT id FROM cards WHERE id = ?").get(id)) return false;
  db.prepare("DELETE FROM follow_ups WHERE card_id = ?").run(id);
  db.prepare("DELETE FROM card_messages WHERE card_id = ?").run(id);
  db.prepare("DELETE FROM cards WHERE id = ?").run(id);
  return true;
}

export function deleteFollowUp(id: string) {
  return getDb().prepare("DELETE FROM follow_ups WHERE id = ?").run(id).changes > 0;
}

export function deleteDeveloper(id: string) {
  const db = getDb();
  if (!db.prepare("SELECT id FROM companies WHERE id = ?").get(id)) return false;
  db.prepare("UPDATE suppliers SET company_id = NULL WHERE company_id = ?").run(id);
  db.prepare("DELETE FROM companies WHERE id = ?").run(id);
  return true;
}

export function deleteEmployee(id: string) {
  const db = getDb();
  if (!db.prepare("SELECT id FROM suppliers WHERE id = ?").get(id)) return false;
  db.prepare("UPDATE cards SET supplier_id = NULL WHERE supplier_id = ?").run(id);
  db.prepare("DELETE FROM suppliers WHERE id = ?").run(id);
  return true;
}

export function deleteChat(jid: string) {
  return getDb().prepare("DELETE FROM chats WHERE jid = ?").run(jid).changes > 0;
}

export function listFollowUps(cardId: string) {
  return getDb()
    .prepare("SELECT * FROM follow_ups WHERE card_id = ? ORDER BY created_at DESC")
    .all(cardId) as import("./types").FollowUp[];
}

export function addFollowUp(cardId: string, note: string, broker: string | null) {
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO follow_ups (id, card_id, note, broker, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, cardId, note, broker, Date.now());
  return id;
}

export function createCard(input: {
  kind: "listing" | "inquiry";
  title: string;
  purpose: string | null;
  propertyType: string | null;
  city: string | null;
  area: string | null;
  price: number | null;
  bedrooms: number | null;
  broker: string | null;
  summary: string | null;
  senderName: string | null;
  senderPhone?: string | null;
  chatJid?: string | null;
  messageId?: string | null;
}) {
  const id = randomUUID();
  const now = Date.now();
  const chatJid = input.chatJid && input.chatJid !== "desk" ? input.chatJid : "desk";
  getDb()
    .prepare(
      `INSERT INTO cards (
        id, chat_jid, sender_name, sender_phone, kind, purpose, property_type, title,
        city, area, price, currency, bedrooms, bathrooms, size_sqm, summary, confidence,
        status, broker, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 1, 'new', ?, ?, ?)`,
    )
    .run(
      id,
      chatJid,
      input.senderName,
      input.senderPhone || null,
      input.kind,
      input.purpose,
      input.propertyType,
      input.title,
      input.city,
      input.area,
      input.price,
      getSettings().currency,
      input.bedrooms,
      input.summary,
      input.broker,
      now,
      now,
    );
  if (chatJid !== "desk") ensureSupplier(chatJid, input.senderName, input.senderPhone || null);
  if (input.messageId) {
    getDb().prepare("INSERT OR IGNORE INTO card_messages (card_id, message_id) VALUES (?, ?)").run(id, input.messageId);
  }
  return id;
}

export function queueReply(chatJid: string, body: string, media?: { file: string; mime: string } | null, notBefore?: number | null) {
  const text = body.trim();
  if ((!text && !media?.file) || text.length > 4000) return null;
  const chat = getDb().prepare("SELECT jid FROM chats WHERE jid = ?").get(chatJid);
  if (!chat) return null;
  const id = randomUUID();
  getDb()
    .prepare(
      "INSERT INTO outbox (id, chat_jid, body, media_file, media_mime, status, error, created_at, sent_at, not_before) VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?, NULL, ?)",
    )
    .run(id, chatJid, text, media?.file || null, media?.mime || null, Date.now(), notBefore ?? null);
  return id;
}

export function claimReplies() {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, chat_jid, body, media_file, media_mime FROM outbox WHERE status = 'pending' AND (not_before IS NULL OR not_before <= ?) ORDER BY created_at ASC LIMIT 1")
    .all(Date.now()) as Array<{ id: string; chat_jid: string; body: string; media_file: string | null; media_mime: string | null }>;
  const claim = db.prepare("UPDATE outbox SET status = 'sending' WHERE id = ? AND status = 'pending'");
  return rows.filter((row) => claim.run(row.id).changes > 0);
}

export function finishReply(id: string, status: "sent" | "failed", error: string | null) {
  getDb()
    .prepare("UPDATE outbox SET status = ?, error = ?, sent_at = ? WHERE id = ?")
    .run(status, error, status === "sent" ? Date.now() : null, id);
}

export function stats() {
  const db = getDb();
  const { start, end } = zonedDayRange(getSettings().timezone);
  const count = (sql: string, ...params: Array<string | number>) =>
    (db.prepare(sql).get(...params) as { n: number }).n;
  return {
    newToday: count("SELECT COUNT(*) AS n FROM cards WHERE created_at >= ?", start),
    listings: count("SELECT COUNT(*) AS n FROM cards WHERE kind = 'listing' AND status != 'closed'"),
    inquiries: count("SELECT COUNT(*) AS n FROM cards WHERE kind = 'inquiry' AND status != 'closed'"),
    needsReview: count("SELECT COUNT(*) AS n FROM cards WHERE status = 'needs_review'"),
    villas: count(
      "SELECT COUNT(*) AS n FROM cards WHERE property_type = 'villa' AND status != 'closed'",
    ),
    apartments: count(
      "SELECT COUNT(*) AS n FROM cards WHERE property_type = 'apartment' AND status != 'closed'",
    ),
    land: count("SELECT COUNT(*) AS n FROM cards WHERE property_type = 'land' AND status != 'closed'"),
    viewings: count("SELECT COUNT(*) AS n FROM cards WHERE status = 'viewing'"),
    offers: count("SELECT COUNT(*) AS n FROM cards WHERE status = 'offer'"),
    fresh: count("SELECT COUNT(*) AS n FROM cards WHERE status = 'new'"),
    contacted: count("SELECT COUNT(*) AS n FROM cards WHERE status = 'contacted'"),
    unassigned: count("SELECT COUNT(*) AS n FROM cards WHERE status != 'closed' AND (broker IS NULL OR broker = '')"),
    pendingSort: count("SELECT COUNT(*) AS n FROM messages WHERE processed = 0"),
    messages: count("SELECT COUNT(*) AS n FROM messages"),
    followUps: count(
      "SELECT COUNT(*) AS n FROM cards WHERE status != 'closed' AND next_follow_up IS NOT NULL AND next_follow_up <= ?",
      end,
    ),
    failedReplies: count("SELECT COUNT(*) AS n FROM outbox WHERE status = 'failed'"),
  };
}

export function dueFollowUps(limit = 5) {
  const { end } = zonedDayRange(getSettings().timezone);
  return getDb()
    .prepare(
      "SELECT id, kind, title, next_follow_up FROM cards WHERE status != 'closed' AND next_follow_up IS NOT NULL AND next_follow_up <= ? ORDER BY next_follow_up ASC LIMIT ?",
    )
    .all(end, limit) as Array<{ id: string; kind: string; title: string | null; next_follow_up: number }>;
}
