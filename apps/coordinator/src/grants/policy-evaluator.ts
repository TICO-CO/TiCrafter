import type { SipStructure } from '../sip/index.js';
import type { GrantDecision } from './types.js';

export class CollaborationPolicyEvaluator {
    evaluate(structure: SipStructure, requesterBotId: string, ownerOnline: boolean): GrantDecision {
        if (structure.ownerBotIds.includes(requesterBotId)) {
            return { kind: 'allow', grantedBy: 'owner' };
        }
        switch (structure.collaboration) {
            case 'open':
                return { kind: 'allow', grantedBy: 'coordinator' };
            case 'private':
                return {
                    kind: 'deny',
                    reason: 'structure_private',
                    message: `structure ${structure.id} is private`,
                };
            case 'invite':
                if (ownerOnline) return { kind: 'allow', grantedBy: 'owner' };
                return { kind: 'owner-offline' };
        }
    }
}
