// ---------------------------------------------------------------------------
// Minimal in-memory Firestore stand-in for tests.
// Supports the subset of the Firestore API used in the backend:
//   collection().doc().set / get / update / delete
//   collection().add
//   collection().where().orderBy().limit().get()
//   doc().collection()  →  subcollection navigation (payslips)
//   collectionGroup(name).where().orderBy().limit().get()  →  cross-subcollection
//   runTransaction(fn)  →  read-verify-write ordering (payslip generation)
//   doc().id, doc().data(), doc().exists, doc().ref
//   FieldValue.serverTimestamp()  →  resolved to a monotonic Date on write
// ---------------------------------------------------------------------------

type ComparisonOp = "==" | "!=" | ">" | ">=" | "<" | "<=";
type SortDirection = "asc" | "desc";

interface Filter {
  field: string;
  op: ComparisonOp;
  value: unknown;
}

// ---- helpers ---------------------------------------------------------------

const SERVER_TIMESTAMP_SENTINEL = { __serverTimestamp: true };

function isServerTimestamp(v: unknown): boolean {
  return (
    v !== null &&
    typeof v === "object" &&
    (v as Record<string, unknown>).__serverTimestamp === true
  );
}

function deepResolve(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepResolve);
  if (obj && typeof obj === "object" && isServerTimestamp(obj)) return new Date();
  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = deepResolve(v);
    }
    return out;
  }
  return obj;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function getField(doc: Record<string, unknown>, field: string): unknown {
  return doc[field];
}

function compareValues(
  actual: unknown,
  op: ComparisonOp,
  expected: unknown,
): boolean {
  switch (op) {
    case "==":
      if (actual instanceof Date && expected instanceof Date)
        return actual.getTime() === expected.getTime();
      return actual === expected;
    case "!=":
      if (actual instanceof Date && expected instanceof Date)
        return actual.getTime() !== expected.getTime();
      return actual !== expected;
    case ">=":
      if (actual instanceof Date && expected instanceof Date)
        return actual.getTime() >= expected.getTime();
      if (typeof actual === "number" && typeof expected === "number")
        return actual >= expected;
      if (typeof actual === "string" && typeof expected === "string")
        return actual >= expected;
      return String(actual) >= String(expected);
    case "<=":
      if (actual instanceof Date && expected instanceof Date)
        return actual.getTime() <= expected.getTime();
      if (typeof actual === "number" && typeof expected === "number")
        return actual <= expected;
      if (typeof actual === "string" && typeof expected === "string")
        return actual <= expected;
      return String(actual) <= String(expected);
    case ">":
      if (actual instanceof Date && expected instanceof Date)
        return actual.getTime() > expected.getTime();
      if (typeof actual === "number" && typeof expected === "number")
        return actual > expected;
      if (typeof actual === "string" && typeof expected === "string")
        return actual > expected;
      return String(actual) > String(expected);
    case "<":
      if (actual instanceof Date && expected instanceof Date)
        return actual.getTime() < expected.getTime();
      if (typeof actual === "number" && typeof expected === "number")
        return actual < expected;
      if (typeof actual === "string" && typeof expected === "string")
        return actual < expected;
      return String(actual) < String(expected);
  }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

// ---- snapshot classes ------------------------------------------------------

class MemoryDocumentSnapshot {
  constructor(
    readonly id: string,
    readonly refPath: string,
    private readonly _data: Record<string, unknown> | undefined,
  ) {}

  get exists(): boolean {
    return this._data !== undefined;
  }

  data(): Record<string, unknown> | undefined {
    return this._data ? deepClone(this._data) : undefined;
  }
}

class MemoryQuerySnapshot {
  constructor(readonly docs: MemoryDocumentSnapshot[]) {}

  get size(): number {
    return this.docs.length;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }

  forEach(callback: (doc: MemoryDocumentSnapshot) => void): void {
    this.docs.forEach(callback);
  }
}

// ---- document reference ----------------------------------------------------

class MemoryDocumentReference {
  constructor(
    private readonly store: MemoryFirestore,
    private readonly collectionPath: string,
    readonly id: string,
  ) {}

  get path(): string {
    return this.collectionPath
      ? `${this.collectionPath}/${this.id}`
      : this.id;
  }

  async get(): Promise<MemoryDocumentSnapshot> {
    const data = this.store.get(this.path);
    return new MemoryDocumentSnapshot(
      this.id,
      this.path,
      data ? deepClone(data) : undefined,
    );
  }

  async set(data: Record<string, unknown>): Promise<void> {
    const resolved = deepResolve(data) as Record<string, unknown>;
    this.store.set(this.path, resolved);
  }

  async create(data: Record<string, unknown>): Promise<void> {
    if (this.store.has(this.path)) {
      const err = new Error(
        "Document already exists.",
      ) as NodeJS.ErrnoException & { code: string };
      err.code = "already-exists";
      throw err;
    }
    const resolved = deepResolve(data) as Record<string, unknown>;
    this.store.set(this.path, resolved);
  }

  async update(data: Record<string, unknown>): Promise<void> {
    const existing = this.store.get(this.path);
    if (!existing) {
      const err = new Error(
        "No document to update.",
      ) as NodeJS.ErrnoException & { code: string };
      err.code = "not-found";
      throw err;
    }
    // Resolve and shallow-merge (sufficient for the fields we update)
    const resolved = deepResolve(data) as Record<string, unknown>;
    this.store.set(this.path, { ...existing, ...resolved });
  }

  async delete(): Promise<void> {
    this.store.delete(this.path);
  }

  collection(name: string): MemoryCollectionReference {
    return new MemoryCollectionReference(
      this.store,
      `${this.collectionPath}/${this.id}/${name}`,
    );
  }
}

// ---- query -----------------------------------------------------------------

class MemoryQuery {
  constructor(
    private readonly store: MemoryFirestore,
    private readonly collectionPath: string,
    private readonly filters: Filter[] = [],
    private readonly orderField?: string,
    private readonly orderDir: SortDirection = "asc",
    private readonly limitN?: number,
    private readonly collectionGroupMode: boolean = false,
  ) {}

  where(field: string, op: ComparisonOp, value: unknown): MemoryQuery {
    return new MemoryQuery(
      this.store,
      this.collectionPath,
      [...this.filters, { field, op, value }],
      this.orderField,
      this.orderDir,
      this.limitN,
      this.collectionGroupMode,
    );
  }

  orderBy(field: string, dir: SortDirection = "asc"): MemoryQuery {
    return new MemoryQuery(
      this.store,
      this.collectionPath,
      this.filters,
      field,
      dir,
      this.limitN,
      this.collectionGroupMode,
    );
  }

  limit(n: number): MemoryQuery {
    return new MemoryQuery(
      this.store,
      this.collectionPath,
      this.filters,
      this.orderField,
      this.orderDir,
      n,
      this.collectionGroupMode,
    );
  }

  async get(): Promise<MemoryQuerySnapshot> {
    let docs: MemoryDocumentSnapshot[] = [];

    if (this.collectionGroupMode) {
      // Collection group: match any path whose second-to-last segment is
      // collectionPath, e.g. `payrollProfiles/{id}/payslips/{payslipId}`.
      const marker = "/" + this.collectionPath + "/";
      for (const [path, data] of this.store.entries()) {
        const idx = path.lastIndexOf(marker);
        if (idx === -1) continue;
        const leaf = path.slice(idx + marker.length);
        if (leaf.includes("/")) continue; // skip deeper nesting
        docs.push(new MemoryDocumentSnapshot(leaf, path, deepClone(data)));
      }
    } else {
      const prefix = this.collectionPath + "/";
      for (const [path, data] of this.store.entries()) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        if (rest.includes("/")) continue; // skip subcollections
        docs.push(
          new MemoryDocumentSnapshot(rest, path, deepClone(data)),
        );
      }
    }

    // Apply filters
    for (const f of this.filters) {
      docs = docs.filter((d) => {
        const docData = d.data();
        if (!docData) return false;
        return compareValues(getField(docData, f.field), f.op, f.value);
      });
    }

    // Sort
    if (this.orderField) {
      const field = this.orderField;
      const dir = this.orderDir;
      docs.sort((a, b) => {
        const aData = a.data();
        const bData = b.data();
        const av = aData ? getFieldValue(aData, field) : undefined;
        const bv = bData ? getFieldValue(bData, field) : undefined;
        let cmp = 0;
        if (av instanceof Date && bv instanceof Date)
          cmp = av.getTime() - bv.getTime();
        else if (typeof av === "number" && typeof bv === "number")
          cmp = av - bv;
        else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
        return dir === "desc" ? -cmp : cmp;
      });
    }

    // Limit
    if (this.limitN !== undefined) {
      docs = docs.slice(0, this.limitN);
    }

    return new MemoryQuerySnapshot(docs);
  }
}

function getFieldValue(data: Record<string, unknown>, field: string): unknown {
  const v = data[field];
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (obj instanceof Date) return obj;
    if (typeof obj.toDate === "function") return obj.toDate();
  }
  return v;
}

// ---- collection reference --------------------------------------------------

class MemoryCollectionReference {
  private seq = 0;

  constructor(
    private readonly store: MemoryFirestore,
    readonly path: string,
  ) {}

  get id(): string {
    const parts = this.path.split("/");
    return parts[parts.length - 1] ?? "";
  }

  doc(id?: string): MemoryDocumentReference {
    if (id === undefined) {
      this.seq += 1;
      const newId = `auto-${Date.now()}-${this.seq}-${randomSuffix()}`;
      return new MemoryDocumentReference(this.store, this.path, newId);
    }
    return new MemoryDocumentReference(this.store, this.path, id);
  }

  async add(data: Record<string, unknown>): Promise<MemoryDocumentReference> {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }

  /**
   * Returns a reference for every top-level document directly in this
   * collection (subcollections are not included), matching the real
   * Firestore `listDocuments()` semantics used by the payslip profile
   * iteration helpers.
   */
  async listDocuments(): Promise<MemoryDocumentReference[]> {
    const refs: MemoryDocumentReference[] = [];
    const prefix = this.path + "/";
    for (const [path] of this.store.entries()) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      if (rest.includes("/")) continue; // skip subcollections
      refs.push(new MemoryDocumentReference(this.store, this.path, rest));
    }
    return refs;
  }

  where(field: string, op: ComparisonOp, value: unknown): MemoryQuery {
    return new MemoryQuery(this.store, this.path, [{ field, op, value }]);
  }

  orderBy(field: string, dir: SortDirection = "asc"): MemoryQuery {
    return new MemoryQuery(this.store, this.path, [], field, dir);
  }

  limit(n: number): MemoryQuery {
    return new MemoryQuery(this.store, this.path, [], undefined, "asc", n);
  }

  async get(): Promise<MemoryQuerySnapshot> {
    return new MemoryQuery(this.store, this.path).get();
  }
}

// ---- root store ------------------------------------------------------------

export class MemoryWriteBatch {
  private ops: Array<{
    path: string;
    data?: Record<string, unknown>;
    type: "set" | "delete";
  }> = [];

  constructor(private readonly store: MemoryFirestore) {}

  set(ref: MemoryDocumentReference, data: Record<string, unknown>): void {
    this.ops.push({ path: ref.path, data: deepResolve(data) as Record<string, unknown>, type: "set" });
  }

  delete(ref: MemoryDocumentReference): void {
    this.ops.push({ path: ref.path, type: "delete" });
  }

  async commit(): Promise<void> {
    for (const op of this.ops) {
      if (op.type === "set") {
        this.store.set(op.path, op.data!);
      } else {
        this.store.delete(op.path);
      }
    }
    this.ops.length = 0;
  }
}

// ---- transaction -----------------------------------------------------------
//
// Single-threaded stand-in for Firestore transactions. The callback runs once
// with a MemoryTransaction whose reads/writes touch the store directly — there
// is no real concurrency in tests, so snapshot isolation is trivially satisfied.
// This is enough to exercise the "read profile → verify no duplicate → create"
// ordering the payslip generator relies on.

class MemoryTransaction {
  constructor(private readonly store: MemoryFirestore) {}

  async get(ref: MemoryDocumentReference): Promise<MemoryDocumentSnapshot> {
    return ref.get();
  }

  set(ref: MemoryDocumentReference, data: Record<string, unknown>): void {
    const resolved = deepResolve(data) as Record<string, unknown>;
    this.store.set(ref.path, resolved);
  }

  update(ref: MemoryDocumentReference, data: Record<string, unknown>): void {
    const existing = this.store.get(ref.path);
    if (!existing) {
      const err = new Error(
        "No document to update.",
      ) as NodeJS.ErrnoException & { code: string };
      err.code = "not-found";
      throw err;
    }
    const resolved = deepResolve(data) as Record<string, unknown>;
    this.store.set(ref.path, { ...existing, ...resolved });
  }

  delete(ref: MemoryDocumentReference): void {
    this.store.delete(ref.path);
  }
}

export class MemoryFirestore {
  private store = new Map<string, Record<string, unknown>>();

  reset(): void {
    this.store.clear();
  }

  entries(): IterableIterator<[string, Record<string, unknown>]> {
    return this.store.entries();
  }

  has(path: string): boolean {
    return this.store.has(path);
  }

  get(path: string): Record<string, unknown> | undefined {
    return this.store.get(path);
  }

  set(path: string, data: Record<string, unknown>): void {
    this.store.set(path, data);
  }

  delete(path: string): void {
    this.store.delete(path);
  }

  collection(path: string): MemoryCollectionReference {
    return new MemoryCollectionReference(this, path);
  }

  batch(): MemoryWriteBatch {
    return new MemoryWriteBatch(this);
  }

  collectionGroup(name: string): MemoryQuery {
    return new MemoryQuery(this, name, [], undefined, "asc", undefined, true);
  }

  runTransaction<T>(fn: (t: MemoryTransaction) => Promise<T>): Promise<T> {
    return fn(new MemoryTransaction(this));
  }

  doc(path: string): MemoryDocumentReference {
    const slash = path.indexOf("/");
    if (slash === -1) {
      return new MemoryDocumentReference(this, "", path);
    }
    const collectionPath = path.slice(0, slash);
    const id = path.slice(slash + 1);
    return new MemoryDocumentReference(this, collectionPath, id);
  }
}

// Stand-in for admin.firestore.FieldValue
export const FieldValue = {
  serverTimestamp: () => deepResolve(SERVER_TIMESTAMP_SENTINEL),
};
