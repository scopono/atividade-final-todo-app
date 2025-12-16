import * as crypto from "expo-crypto";
import { SQLiteDatabase } from "expo-sqlite";
import { TodoItem, TodoList } from "./types";

const logError = (context: string, error: any) => {
  console.error(`[DB_ERROR] ${context}:`, error);
};

async function migrateFrom0To1(db: SQLiteDatabase) {
  console.log("Migrating DB: 0 -> 1");
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
  console.log("Migrating DB: 1 -> 2");
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
  console.log("Migrating DB: 2 -> 3");
  await db.execAsync(`
    ALTER TABLE todos ADD COLUMN notes TEXT;
  `);

  await db.execAsync(`
    ALTER TABLE todos ADD COLUMN dueDate TEXT;
  `);
}

export async function migrateDB(db: SQLiteDatabase) {
  const DATABASE_VERSION = 3;

  try {
    await db.execAsync("PRAGMA foreign_keys = ON;");
    
    const userVersionRow = await db.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version"
    );

    let currentDbVersion = userVersionRow?.user_version ?? 0;

    console.log(`Checking DB Version. Current: ${currentDbVersion}, Target: ${DATABASE_VERSION}`);

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
          throw new Error(`Unknown DB version: ${currentDbVersion}`);
      }
      currentDbVersion++;
    }

    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    console.log(`DB Migration completed. Version is now ${DATABASE_VERSION}`);
    
  } catch (error) {
    logError("migrateDB", error);
    throw error; 
  }
}

export function getSQLiteVersion(db: SQLiteDatabase) {
  return db.getFirstAsync<{ "sqlite_version()": string }>(
    "SELECT sqlite_version()"
  ).catch(e => {
    logError("getSQLiteVersion", e);
    return null;
  });
}

export async function getDBVersion(db: SQLiteDatabase) {
  return await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  ).catch(e => {
    logError("getDBVersion", e);
    return null;
  });
}

export async function getAllTodos(db: SQLiteDatabase): Promise<TodoItem[]> {
  try {
    console.log("[DB] Executando getAllTodos");
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
  } catch (error) {
    logError("getAllTodos", error);
    return []; 
  }
}

export async function getAllLists(db: SQLiteDatabase): Promise<TodoList[]> {
  try {
    return await db.getAllAsync<TodoList>(
      "SELECT id, name, createdAt FROM lists ORDER BY createdAt;"
    );
  } catch (error) {
    logError("getAllLists", error);
    return [];
  }
}

export async function createTodo(
  db: SQLiteDatabase,
  text: string,
  listId: string,
  notes?: string | null,
  dueDate?: string | null
): Promise<TodoItem | null> {
  try {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const result = await db.getFirstAsync<TodoItem>(
      "INSERT INTO todos (id, text, done, createdAt, notes, dueDate, listId) VALUES (?, ?, 0, ?, ?, ?, ?) RETURNING *;",
      [id, text, createdAt, notes ?? null, dueDate ?? null, listId]
    );
    console.log(`Todo created: ${id}`);
    return result ?? null;
  } catch (error) {
    logError("createTodo", error);
    throw error; 
  }
}

export async function getTodoById(db: SQLiteDatabase, id: string): Promise<TodoItem | null> {
  try {
    console.log(`[DB] Executando getTodoById: ${id}`);
    const result = await db.getFirstAsync<TodoItem | null>(`
      SELECT t.*, l.name as listName 
      FROM todos t 
      JOIN lists l ON l.id = t.listId
      WHERE t.id = ?;
    `, [id]);
    return result;
  } catch (error) {
    logError("getTodoById", error);
    return null;
  }
}

export async function updateTodoDetails(
  db: SQLiteDatabase,
  id: string,
  notes: string | null,
  dueDate: string | null
): Promise<TodoItem | null> {
  try {
    const result = await db.getFirstAsync<TodoItem | null>(`
      UPDATE todos
      SET notes = ?, dueDate = ?
      WHERE id = ?
      RETURNING id, text, done, createdAt, notes, dueDate, listId;
    `, [notes, dueDate, id]);
    console.log(`Todo details updated: ${id}`);
    return result;
  } catch (error) {
    logError("updateTodoDetails", error);
    throw error;
  }
}

export async function createList(db: SQLiteDatabase, name: string): Promise<TodoList | null> {
  try {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const result = await db.getFirstAsync<TodoList>(
      `INSERT INTO lists (id, name, createdAt)
       VALUES (?, ?, ?)
       RETURNING *;`,
      [id, name, createdAt]
    );
    console.log(`List created: ${name}`);
    return result ?? null;
  } catch (error) {
    logError("createList", error);
    throw error;
  }
}

export async function updateTodoStatus(
  db: SQLiteDatabase,
  id: string,
  done: boolean
): Promise<TodoItem | null> {
  try {
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
    console.log(`Todo status updated: ${id} -> ${done}`);
    return updated ?? null;
  } catch (error) {
    logError("updateTodoStatus", error);
    return null; 
  }
}

export async function deleteTodo(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  try {
    await db.runAsync(
      "DELETE FROM todos WHERE id = ?;",
      [id]
    );
    console.log(`Todo deleted: ${id}`);
  } catch (error) {
    logError("deleteTodo", error);
    throw error;
  }
}
