import type { SipStructure } from '../sip/index.js';
import type { GrantDecision } from './types.js';

export class OwnerOfflinePolicy {
    evaluate(structure: SipStructure, compatible: boolean): GrantDecision {
        if (!structure.autoAcceptCompatibleHelpers) {
            return {
                kind: 'deny',
                reason: 'owner_offline',
                message: `owner of ${structure.id} is offline`,
            };
        }
        if (!compatible) {
            return {
                kind: 'deny',
                reason: 'owner_policy_denied',
                message: `proposed edit is not compatible with ${structure.id}`,
            };
        }
        return { kind: 'allow', grantedBy: 'owner' };
    }
}
