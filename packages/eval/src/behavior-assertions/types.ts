import type { Vec3 } from '@ticrafter/core';

export interface StoredEventView {
    type: string;
    botId: string | null;
    at: string;
    payload: unknown;
}

export interface StoredBlockWriteView {
    botId: string | null;
    position: Vec3;
    authorized: boolean;
    at: string;
}

export interface StoredTaskView {
    id: string;
    status: string;
    failureClass?: string | null;
}

export type ScenarioAssertion =
    | { id: string; kind: 'world.diff-empty'; schematicId: string; anchor: Vec3; message: string }
    | { id: string; kind: 'world.block-exists'; position: Vec3; blockId: string; message: string }
    | { id: string; kind: 'world.no-duplicate-writes'; message: string }
    | { id: string; kind: 'task.status'; taskId: string; status: string; message: string }
    | {
          id: string;
          kind: 'task.failure-class';
          taskId: string;
          failureClass: string;
          message: string;
      }
    | { id: string; kind: 'event.exists'; eventType: string; message: string }
    | { id: string; kind: 'event.absent'; eventType: string; message: string }
    | { id: string; kind: 'safety.no-veto'; message: string }
    | { id: string; kind: 'safety.veto'; reason: string; message: string };

export interface AssertionWorldView {
    blockAt(position: Vec3): string | null;
    blockStateAt?(
        position: Vec3,
    ): { name: string; properties: Readonly<Record<string, string>> } | null;
}

export interface AssertionContext {
    world: AssertionWorldView;
    tasks: readonly StoredTaskView[];
    events: readonly StoredEventView[];
    blockWrites: readonly StoredBlockWriteView[];
    vetoes: readonly { reason: string }[];
}

export interface AssertionResult {
    id: string;
    passed: boolean;
    expected: unknown;
    actual: unknown;
    message: string;
    refs: readonly string[];
}
