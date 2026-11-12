import type {
    AgencySnapshot,
    Goal,
    Intention,
    NeedsModel,
    PersonalityModel,
    RoutineState,
} from '@ticrafter/agency';

export interface AgencySnapshotPort {
    read(): {
        snapshot: AgencySnapshot;
        needs: NeedsModel;
        traits: PersonalityModel;
        routine: RoutineState;
    };
}

export interface AgencyStateAdapterOptions {
    botId: string;
    snapshots: AgencySnapshotPort;
    persist: (intention: Intention | null) => void;
}

export class AgencyStateAdapter {
    constructor(private readonly options: AgencyStateAdapterOptions) {}

    snapshot(): ReturnType<AgencySnapshotPort['read']> {
        return this.options.snapshots.read();
    }

    goalStarted(goal: Goal, intention: Intention): void {
        this.options.persist(intention);
    }

    goalFinished(intention: Intention | null): void {
        this.options.persist(intention);
    }
}
