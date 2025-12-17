import { SQLiteDatabase } from "expo-sqlite";

import * as crypto from "expo-crypto";
import { TodoItem, TodoList } from "./types";

async function migrateFrom0To1(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      done INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
}

async function migrateFrom1To2(db: SQLiteDatabase) {
  const now = new Date().toISOString();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    INSERT OR IGNORE INTO lists (id, name, createdAt)
    VALUES ('default_list', 'Geral', '${now}');
  `);

  await db.execAsync(`
    ALTER TABLE todos
    ADD COLUMN listId TEXT NOT NULL DEFAULT 'default_list';
  `);
}

async function migrateFrom2To3(db: SQLiteDatabase) {
  await db.execAsync(`
    ALTER TABLE todos ADD COLUMN notes TEXT;
  `);


  await db.execAsync(`
    ALTER TABLE todos ADD COLUMN dueDate TEXT;
  `);
}


export async function migrateDB(db: SQLiteDatabase) {
  
  const DATABASE_VERSION = 3;

  const userVersionRow = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  );

  let currentDbVersion = userVersionRow?.user_version ?? 0;

   if (currentDbVersion === 0) {
    console.log("Running initial database setup...");
    console.log(
      `Current DB version: ${currentDbVersion}, Target DB version: ${DATABASE_VERSION}`
    );

  }

  while (currentDbVersion < DATABASE_VERSION) {
    switch (currentDbVersion) {
      case 0:
        await migrateFrom0To1(db);
        break;
      case 1:
        await migrateFrom1To2(db);
        break;
      case 2:
        await migrateFrom2To3(db);
        break;
      default:
        throw new Error("Unknown DB version");
    
    }
    currentDbVersion++;
}
  //Outras atualizações de versão
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  
  if (currentDbVersion === DATABASE_VERSION) return;
}

async function initializeDB(db: SQLiteDatabase) {
  const todo1Id = crypto.randomUUID();
  const todo2Id = crypto.randomUUID();
  const todo3Id = crypto.randomUUID();


  db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS lists (id TEXT PRIMARY KEY, name TEXT NOT NULL, createdAt TEXT NOT NULL);
        INSERT INTO lists (id, name, createdAt) VALUES ('default_list', 'Geral', '${new Date().toISOString()}');
        CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, text TEXT NOT NULL, done INTEGER NOT NULL, 
        createdAt TEXT NOT NULL, notes TEXT, dueDate TEXT, listId TEXT NOT NULL DEFAULT 'default_list', 
        FOREIGN KEY (listId) REFERENCES lists(id));
        INSERT INTO todos (id, text, done, createdAt, notes, dueDate) 
        VALUES ('${todo1Id}', 'Sample Todo from DB', 0, '2023-01-01T00:00:00Z', 'notaTeste', '2023-10-0100:00:00Z');
        INSERT INTO todos (id, text, done, createdAt, notes, dueDate) 
        VALUES ('${todo2Id}', 'Sample Todo 2 from DB', 1, '2023-01-02T00:00:00Z', 'notaTeste', '2023-10-0100:00:00Z');
        INSERT INTO todos (id, text, done, createdAt, notes, dueDate) 
        VALUES ('${todo3Id}', 'Sample Todo 3 from DB', 0, '2023-01-03T00:00:00Z', 'notaTeste', '2023-10-0100:00:00Z');
    `);
}

export function getSQLiteVersion(db: SQLiteDatabase) {
  return db.getFirstAsync<{ "sqlite_version()": string }>(
    "SELECT sqlite_version()"
  );
}

export async function getDBVersion(db: SQLiteDatabase) {
  return await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  );
}

export async function getAllTodos(db: SQLiteDatabase): Promise<TodoItem[]> {
  const result = await db.getAllAsync<TodoItem>(
    `SELECT t.*, l.name as listName 
    FROM todos t 
    JOIN lists l ON l.id = t.listId
    ORDER BY
      done ASC,
      CASE
        WHEN dueDate is NULL or dueDate = '' THEN 1
        ELSE 0
      END,
      dueDate ASC,
      createdAt DESC;
    `
  );
  return result;
}

export async function getAllLists(db: SQLiteDatabase): Promise<TodoList[]> {
  return await db.getAllAsync<TodoList>(
    "SELECT id, name, createdAt FROM lists ORDER BY createdAt;"
  );
}

export async function createTodo(
  db: SQLiteDatabase,
  text: string,
  listId: string,
  notes?: string | null,
  dueDate?: string | null
): Promise<TodoItem> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const result = await db.getFirstAsync<TodoItem>(
    "INSERT INTO todos (id, text, done, createdAt, notes, dueDate, listId) VALUES (?, ?, 0, ?, ?, ?, ?) RETURNING *;",
    [id, text, createdAt, notes ?? null, dueDate ?? null, listId]
  );
  return result!;
}

export async function getTodoById(db: SQLiteDatabase, id: string): Promise<TodoItem | null> {
  const result = await db.getFirstAsync<TodoItem | null>(`
    SELECT t.*, l.name as listName 
    FROM todos t 
    JOIN lists l ON l.id = t.listId
    WHERE t.id = ?;
  `, [id]);

  return result;
}

export async function updateTodoDetails(
  db: SQLiteDatabase,
  id: string,
  notes: string | null,
  dueDate: string | null
): Promise<TodoItem | null> {
  const result = await db.getFirstAsync<TodoItem | null>(`
    UPDATE todos
    SET notes = ?, dueDate = ?
    WHERE id = ?
    RETURNING id, text, done, createdAt, notes, dueDate, listId;
  `, [notes, dueDate, id]);

  return result;
}

export async function createList(db: SQLiteDatabase, name: string): Promise<TodoList> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const result = await db.getFirstAsync<TodoList>(
    `INSERT INTO lists (id, name, createdAt)
     VALUES (?, ?, ?)
     RETURNING *;`,
    [id, name, createdAt]
  );
  return result!;
}


export async function updateTodoStatus(
  db: SQLiteDatabase,
  id: string,
  done: boolean
): Promise<TodoItem | null> {
  await db.runAsync(
    "UPDATE todos SET done = ? WHERE id = ?;",
    [done ? 1 : 0, id]
  );

  const updated = await db.getFirstAsync<TodoItem>(
    `
    SELECT t.*, l.name AS listName
    FROM todos t
    JOIN lists l ON l.id = t.listId
    WHERE t.id = ?;
    `,
    [id]
  );

  return updated ?? null;
}
