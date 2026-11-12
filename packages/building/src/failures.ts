import type { Vec3 } from '@ticrafter/core';

export type BuildingFailure =
    | { type: 'INVALID_BLUEPRINT'; message: string }
    | { type: 'INVALID_BLOCK'; message: string }
    | { type: 'INVALID_MATERIAL'; message: string }
    | { type: 'INVALID_CONSTRAINT'; message: string }
    | { type: 'INVALID_ROTATION'; value: number }
    | { type: 'DUPLICATE_POSITION'; position: Vec3 }
    | { type: 'PROTECTED_REGION'; position: Vec3 }
    | { type: 'NO_BUILD_ZONE'; position: Vec3 }
    | { type: 'UNKNOWN_TEMPLATE'; templateType: string }
    | { type: 'TEMPLATE_FAILED'; templateType: string; message: string }
    | { type: 'UNSUPPORTED_FORMAT'; format: string }
    | { type: 'PARSE_FAILED'; message: string }
    | { type: 'WORLD_QUERY_FAILED'; message: string }
    | { type: 'INVALID_PACKAGE'; message: string }
    | { type: 'UNREACHABLE'; message: string }
    | { type: 'MISSING_MATERIALS'; items: readonly string[] }
    | { type: 'SAFETY_VETO'; reason: string }
    | { type: 'ACTION_FAILED'; message: string }
    | { type: 'ACTION_REJECTED'; message: string }
    | { type: 'RATE_LIMITED'; message: string }
    | { type: 'JOURNAL_FAILED'; message: string }
    | { type: 'VERIFICATION_FAILED'; message: string }
    | { type: 'COMPOSE_FAILED'; message: string }
    | { type: 'UNSUPPORTED_SOURCE'; source: string }
    | { type: 'RAW_BLUEPRINTS_DISABLED' }
    | { type: 'OBSERVATION_FAILED'; message: string }
    | { type: 'SITE_REJECTED'; message: string }
    | { type: 'FOUNDATION_FAILED'; message: string }
    | { type: 'INVALID_CONSTRUCTION_PLAN'; message: string }
    | { type: 'STRUCTURAL_FAILURE'; position: Vec3 };

export class BuildingFailures {
    static composeFailed(message: string): BuildingFailure {
        return { type: 'COMPOSE_FAILED', message };
    }

    static unsupportedSource(source: string): BuildingFailure {
        return { type: 'UNSUPPORTED_SOURCE', source };
    }

    static rawBlueprintsDisabled(): BuildingFailure {
        return { type: 'RAW_BLUEPRINTS_DISABLED' };
    }

    static observationFailed(message: string): BuildingFailure {
        return { type: 'OBSERVATION_FAILED', message };
    }

    static invalidBlueprint(message: string): BuildingFailure {
        return { type: 'INVALID_BLUEPRINT', message };
    }

    static worldQueryFailed(message: string): BuildingFailure {
        return { type: 'WORLD_QUERY_FAILED', message };
    }

    static siteRejected(message: string): BuildingFailure {
        return { type: 'SITE_REJECTED', message };
    }

    static foundationFailed(message: string): BuildingFailure {
        return { type: 'FOUNDATION_FAILED', message };
    }

    static invalidConstructionPlan(message: string): BuildingFailure {
        return { type: 'INVALID_CONSTRUCTION_PLAN', message };
    }

    static structuralFailure(position: Vec3): BuildingFailure {
        return { type: 'STRUCTURAL_FAILURE', position };
    }

    static describe(failure: BuildingFailure): string {
        switch (failure.type) {
            case 'INVALID_BLUEPRINT':
            case 'INVALID_BLOCK':
            case 'INVALID_MATERIAL':
            case 'INVALID_CONSTRAINT':
            case 'PARSE_FAILED':
            case 'WORLD_QUERY_FAILED':
            case 'INVALID_PACKAGE':
            case 'UNREACHABLE':
            case 'ACTION_FAILED':
            case 'ACTION_REJECTED':
            case 'RATE_LIMITED':
            case 'JOURNAL_FAILED':
            case 'VERIFICATION_FAILED':
            case 'TEMPLATE_FAILED':
            case 'COMPOSE_FAILED':
            case 'OBSERVATION_FAILED':
            case 'SITE_REJECTED':
            case 'FOUNDATION_FAILED':
            case 'INVALID_CONSTRUCTION_PLAN':
                return failure.message;
            case 'INVALID_ROTATION':
                return `invalid blueprint rotation ${failure.value}`;
            case 'DUPLICATE_POSITION':
                return `duplicate block at ${BuildingFailures.position(failure.position)}`;
            case 'PROTECTED_REGION':
                return `block intersects a protected region at ${BuildingFailures.position(
                    failure.position,
                )}`;
            case 'NO_BUILD_ZONE':
                return `block is inside a no-build zone at ${BuildingFailures.position(
                    failure.position,
                )}`;
            case 'UNKNOWN_TEMPLATE':
                return `unknown template ${failure.templateType}`;
            case 'UNSUPPORTED_FORMAT':
                return `unsupported schematic format ${failure.format}`;
            case 'MISSING_MATERIALS':
                return `missing build materials: ${failure.items.join(', ')}`;
            case 'SAFETY_VETO':
                return `safety veto: ${failure.reason}`;
            case 'UNSUPPORTED_SOURCE':
                return `unsupported blueprint source ${failure.source}`;
            case 'RAW_BLUEPRINTS_DISABLED':
                return 'raw block blueprints are disabled';
            case 'STRUCTURAL_FAILURE':
                return `unsupported block at ${BuildingFailures.position(failure.position)}`;
        }
    }

    private static position(position: Vec3): string {
        return `${position.x},${position.y},${position.z}`;
    }
}
