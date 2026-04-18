import type { SecurityProfile } from 'shared-contracts';

export interface SecurityCapabilities {
  enforceExpiry: boolean;
  enforceAudience: boolean;
  enforceRequestHash: boolean;
  enforceReplayProtection: boolean;
  enforceSod: boolean;
  enforceAbac: boolean;
}

export function getSecurityCapabilities(profile: SecurityProfile): SecurityCapabilities {
  if (profile === 'vulnerable') {
    return {
      enforceExpiry: false,
      enforceAudience: false,
      enforceRequestHash: false,
      enforceReplayProtection: false,
      enforceSod: false,
      enforceAbac: false,
    };
  }

  return {
    enforceExpiry: true,
    enforceAudience: true,
    enforceRequestHash: true,
    enforceReplayProtection: true,
    enforceSod: true,
    enforceAbac: true,
  };
}
