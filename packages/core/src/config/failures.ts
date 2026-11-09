export type ConfigFailure =
    | { type: 'READ_FAILED'; path: string; message: string }
    | { type: 'INVALID'; issues: string[] }
    | { type: 'NAME_POOL'; message: string }
    | { type: 'PLANNER_SECRETS'; message: string };
