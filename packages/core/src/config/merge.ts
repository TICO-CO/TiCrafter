type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export class DeepMerge {
    static merge<T>(base: T, ...overrides: unknown[]): T {
        let result: unknown = base;
        for (const override of overrides) {
            result = DeepMerge.mergeValue(result, override);
        }
        return result as T;
    }

    private static mergeValue(base: unknown, override: unknown): unknown {
        if (override === undefined) return base;
        if (!isPlainObject(base) || !isPlainObject(override)) return override;
        const merged: PlainObject = { ...base };
        for (const [key, value] of Object.entries(override)) {
            merged[key] = DeepMerge.mergeValue(merged[key], value);
        }
        return merged;
    }
}
