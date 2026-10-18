import { createHash } from 'node:crypto';

export enum VoteType {
  Against = 0,
  For = 1,
  Abstain = 2
}

export interface ActionParam {
  readonly target: string;
  readonly value: bigint;
  readonly signature: string;
  readonly calldata: string;
}

export interface ProposalRequest {
  readonly proposer: string;
  readonly description: string;
  readonly actions: readonly ActionParam[];
}

export interface TimelockStatus {
  readonly eta: number;
  readonly currentTime: number;
  readonly isQueued: boolean;
  readonly isReady: boolean;
  readonly isExpired: boolean;
  readonly timeRemainingSeconds: number;
  readonly timeUntilExpirySeconds: number;
  readonly status: 'NOT_QUEUED' | 'LOCKED' | 'READY' | 'EXPIRED';
}

export interface QuorumMetrics {
  readonly participatingVotes: bigint;
  readonly quorumRequired: bigint;
  readonly quorumReached: boolean;
  readonly percentageBps: number; // Basis points (10000 = 100%)
}

export function buildProposeIntent(proposer: string, description: string): { readonly payload: string; readonly signature: string } {
  if (!proposer || proposer.trim() === '') {
    throw new Error('INVALID_PROPOSER_ADDRESS');
  }
  if (!description || description.trim() === '') {
    throw new Error('EMPTY_DESCRIPTION');
  }
  const payload = `${proposer}:PROPOSE:${description}`;
  const signature = createHash('sha256').update(payload).digest('hex');
  return Object.freeze({ payload, signature });
}

export function buildVoteIntent(
  voter: string,
  proposalId: string,
  support: VoteType
): { readonly payload: string; readonly signature: string } {
  if (!voter || voter.trim() === '') {
    throw new Error('INVALID_VOTER_ADDRESS');
  }
  if (!proposalId || proposalId.trim() === '') {
    throw new Error('INVALID_PROPOSAL_ID');
  }
  if (support !== VoteType.Against && support !== VoteType.For && support !== VoteType.Abstain) {
    throw new Error('INVALID_VOTE_TYPE');
  }
  const payload = `${voter}:VOTE:${proposalId}:${support}`;
  const signature = createHash('sha256').update(payload).digest('hex');
  return Object.freeze({ payload, signature });
}

export function calculateTimelockStatus(
  eta: number,
  currentTime: number,
  gracePeriod: number = 14 * 86400
): Readonly<TimelockStatus> {
  if (eta === 0) {
    return Object.freeze({
      eta: 0,
      currentTime,
      isQueued: false,
      isReady: false,
      isExpired: false,
      timeRemainingSeconds: 0,
      timeUntilExpirySeconds: 0,
      status: 'NOT_QUEUED'
    });
  }

  const expiry = eta + gracePeriod;
  if (currentTime < eta) {
    return Object.freeze({
      eta,
      currentTime,
      isQueued: true,
      isReady: false,
      isExpired: false,
      timeRemainingSeconds: eta - currentTime,
      timeUntilExpirySeconds: expiry - currentTime,
      status: 'LOCKED'
    });
  }

  if (currentTime > expiry) {
    return Object.freeze({
      eta,
      currentTime,
      isQueued: true,
      isReady: false,
      isExpired: true,
      timeRemainingSeconds: 0,
      timeUntilExpirySeconds: 0,
      status: 'EXPIRED'
    });
  }

  return Object.freeze({
    eta,
    currentTime,
    isQueued: true,
    isReady: true,
    isExpired: false,
    timeRemainingSeconds: 0,
    timeUntilExpirySeconds: expiry - currentTime,
    status: 'READY'
  });
}

export function calculateQuorumMetrics(
  forVotes: bigint,
  abstainVotes: bigint,
  quorumRequired: bigint
): Readonly<QuorumMetrics> {
  const participatingVotes = forVotes + abstainVotes;
  const quorumReached = participatingVotes >= quorumRequired;

  let percentageBps = 0;
  if (quorumRequired > 0n) {
    const rawBps = (participatingVotes * 10000n) / quorumRequired;
    percentageBps = rawBps > 10000n ? 10000 : Number(rawBps);
  }

  return Object.freeze({
    participatingVotes,
    quorumRequired,
    quorumReached,
    percentageBps
  });
}

export class GovernanceClient {
  public validateProposal(request: ProposalRequest): void {
    if (!request.proposer || request.proposer.trim() === '') {
      throw new Error('INVALID_PROPOSER_ADDRESS');
    }
    if (!request.description || request.description.trim() === '') {
      throw new Error('EMPTY_DESCRIPTION');
    }
    if (!request.actions || request.actions.length === 0) {
      throw new Error('EMPTY_PROPOSAL_ACTIONS');
    }
    for (const act of request.actions) {
      if (!act.target || act.target.trim() === '') {
        throw new Error('INVALID_ACTION_TARGET');
      }
      if (act.value < 0n) {
        throw new Error('NEGATIVE_VALUE_NOT_ALLOWED');
      }
    }
  }

  public preparePropose(request: ProposalRequest): {
    readonly request: ProposalRequest;
    readonly intent: { readonly payload: string; readonly signature: string };
  } {
    this.validateProposal(request);
    const intent = buildProposeIntent(request.proposer, request.description);
    return Object.freeze({
      request: Object.freeze({
        ...request,
        actions: request.actions.map(a => Object.freeze({ ...a }))
      }),
      intent
    });
  }

  public prepareVote(voter: string, proposalId: string, support: VoteType): {
    readonly voter: string;
    readonly proposalId: string;
    readonly support: VoteType;
    readonly intent: { readonly payload: string; readonly signature: string };
  } {
    const intent = buildVoteIntent(voter, proposalId, support);
    return Object.freeze({
      voter,
      proposalId,
      support,
      intent
    });
  }
}
