export class SipEntityList {
    static upsert<T extends { id: string }>(items: readonly T[], item: T): readonly T[] {
        const existingIndex = items.findIndex((existing) => existing.id === item.id);
        if (existingIndex === -1) return [...items, item];
        return items.map((existing, index) => (index === existingIndex ? item : existing));
    }

    static remove<T extends { id: string }>(items: readonly T[], id: string): readonly T[] {
        return items.filter((item) => item.id !== id);
    }
}
