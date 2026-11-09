declare module 'bun:test' {
    export interface Matchers {
        toBe(expected: unknown): void;
        toBeNull(): void;
        toMatchObject(expected: unknown): void;
        toEqual(expected: unknown): void;
        toHaveLength(length: number): void;
        readonly not: Matchers;
    }

    export interface Expect {
        (actual: unknown): Matchers;
        arrayContaining(items: unknown[]): unknown;
    }

    export const expect: Expect;
    export function describe(name: string, operation: () => void): void;
    export function it(name: string, operation: () => void): void;
    export function afterEach(operation: () => void): void;
}
