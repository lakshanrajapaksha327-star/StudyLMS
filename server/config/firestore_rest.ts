import { FIREBASE_APPLET_CONFIG } from '../lib/firebase-admin';
import { ApiError } from '../middleware/validate.middleware';

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

const PROJECT_ID = FIREBASE_APPLET_CONFIG.projectId;
const DATABASE_ID = FIREBASE_APPLET_CONFIG.firestoreDatabaseId || '(default)';
const BASE_DOC_ROOT = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const BASE_URL = `https://firestore.googleapis.com/v1/${BASE_DOC_ROOT}`;

function toFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { doubleValue: 0 };
    if (Number.isInteger(val) && Math.abs(val) <= Number.MAX_SAFE_INTEGER) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.filter((v) => v !== undefined).map((v) => toFirestoreValue(v)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return undefined;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('stringValue' in val) return String(val.stringValue);
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('arrayValue' in val) {
    const values = val.arrayValue?.values || [];
    return values.map((v: any) => fromFirestoreValue(v));
  }
  if ('mapValue' in val) {
    const out: Record<string, any> = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return undefined;
}

function fromFirestoreDoc<T>(doc: any): T {
  const fields = doc?.fields || {};
  const obj: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = fromFirestoreValue(v);
  }
  return obj as T;
}

function toFirestoreFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

async function firestoreFetch(url: string, idToken: string, init: RequestInit = {}) {
  const resp = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(init.headers || {}),
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    let msg = `Firestore error (${resp.status})`;
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.error?.message || msg;
    } catch {
      // ignore
    }
    if (resp.status === 404) {
      throw new ApiError(404, msg, 'FIRESTORE_NOT_FOUND');
    }
    if (resp.status === 403 || resp.status === 401) {
      throw new ApiError(403, msg, 'FIRESTORE_PERMISSION_DENIED');
    }
    if (resp.status === 429) {
      throw new ApiError(429, 'Firestore quota exceeded.', 'FIRESTORE_QUOTA');
    }
    throw new ApiError(resp.status >= 500 ? 502 : 400, msg, 'FIRESTORE_ERROR');
  }

  return resp.json();
}

export class FirestoreRestClient {
  public async getDoc<T>(collection: string, docId: string, idToken: string): Promise<T | null> {
    try {
      const data = await firestoreFetch(
        `${BASE_URL}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`,
        idToken,
        { method: 'GET' }
      );
      return fromFirestoreDoc<T>(data);
    } catch (err: any) {
      if (err instanceof ApiError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  public async setDoc<T extends Record<string, any>>(
    collection: string,
    docId: string,
    data: T,
    idToken: string
  ): Promise<T> {
    const saved = await firestoreFetch(
      `${BASE_URL}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`,
      idToken,
      {
        method: 'PATCH',
        body: JSON.stringify({
          fields: toFirestoreFields(data),
        }),
      }
    );
    return fromFirestoreDoc<T>(saved);
  }

  public async patchDoc<T extends Record<string, any>>(
    collection: string,
    docId: string,
    updates: Record<string, unknown>,
    idToken: string
  ): Promise<T> {
    const keys = Object.keys(updates).filter((k) => updates[k] !== undefined);
    if (keys.length === 0) {
      const existing = await this.getDoc<T>(collection, docId, idToken);
      if (!existing) throw new ApiError(404, 'Document not found', 'NOT_FOUND');
      return existing;
    }

    const maskParams = keys
      .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
      .join('&');

    const saved = await firestoreFetch(
      `${BASE_URL}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}?${maskParams}`,
      idToken,
      {
        method: 'PATCH',
        body: JSON.stringify({
          fields: toFirestoreFields(updates),
        }),
      }
    );
    return fromFirestoreDoc<T>(saved);
  }

  public async deleteDoc(collection: string, docId: string, idToken: string): Promise<boolean> {
    try {
      await firestoreFetch(
        `${BASE_URL}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`,
        idToken,
        { method: 'DELETE' }
      );
      return true;
    } catch (err: any) {
      if (err instanceof ApiError && err.statusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Query collection scoped strictly by userId (single-field index, zero composite index failures)
   */
  public async listByUser<T>(
    collection: string,
    userId: string,
    idToken: string,
    limit = 500
  ): Promise<T[]> {
    const body = {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op: 'EQUAL',
            value: { stringValue: userId },
          },
        },
        limit,
      },
    };

    const rows = await firestoreFetch(`${BASE_URL}:runQuery`, idToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!Array.isArray(rows)) return [];
    const results: T[] = [];
    for (const row of rows) {
      if (row.document) {
        results.push(fromFirestoreDoc<T>(row.document));
      }
    }
    return results;
  }

  /**
   * Admin-only full collection scan (requires isAdmin() in firestore.rules)
   */
  public async listAllAdmin<T>(collection: string, idToken: string, limit = 500): Promise<T[]> {
    const body = {
      structuredQuery: {
        from: [{ collectionId: collection }],
        limit,
      },
    };

    const rows = await firestoreFetch(`${BASE_URL}:runQuery`, idToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r: any) => Boolean(r.document))
      .map((r: any) => fromFirestoreDoc<T>(r.document));
  }

  /**
   * Batch fetch specific document IDs in groups of 80 using Firestore batchGet
   */
  public async batchGetDocs<T>(
    collection: string,
    docIds: string[],
    idToken: string
  ): Promise<T[]> {
    if (docIds.length === 0) return [];
    const results: T[] = [];
    const batchSize = 80;

    for (let i = 0; i < docIds.length; i += batchSize) {
      const slice = docIds.slice(i, i + batchSize);
      const documents = slice.map(
        (id) => `${BASE_DOC_ROOT}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`
      );

      const resp = await firestoreFetch(`${BASE_URL}:batchGet`, idToken, {
        method: 'POST',
        body: JSON.stringify({ documents }),
      });

      if (Array.isArray(resp)) {
        for (const item of resp) {
          if (item.found) {
            results.push(fromFirestoreDoc<T>(item.found));
          }
        }
      }
    }

    return results;
  }

  public getConfigInfo() {
    return {
      projectId: PROJECT_ID,
      databaseId: DATABASE_ID,
    };
  }
}

export const firestoreRest = new FirestoreRestClient();
