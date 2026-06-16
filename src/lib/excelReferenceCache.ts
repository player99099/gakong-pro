const DB_NAME = 'gakong_excel_ref';
const DB_VERSION = 1;
const STORE = 'reference';
const BUFFER_KEY = 'master';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
  });
}

/** 형식 설정 시 샘플 엑셀을 참조용으로 저장 */
export async function saveReferenceExcel(buffer: ArrayBuffer): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(buffer, BUFFER_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadReferenceExcel(): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(BUFFER_KEY);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as ArrayBuffer | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function hasReferenceExcel(): Promise<boolean> {
  const buf = await loadReferenceExcel();
  return buf != null && buf.byteLength > 0;
}
