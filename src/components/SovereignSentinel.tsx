'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AgeVerificationModal } from './AgeVerificationModal';
import { useSovereignStatus } from '@/hooks/useSovereignStatus';
import { SovereignLock } from './SovereignLock';
import { SovereignAlert } from './SovereignAlert';

/**
 * The Sovereign Sentinel is a root-level compliance enforcer.
 * It monitors the global protection status and anchors the physical
 * Age Verification gate OR the Sovereign Lock when compliance is breached.
 */
export function SovereignSentinel() {
  const { avRequired, setAvVerified } = useAuth();
  const { gated, status, message, breachedPolicies } = useSovereignStatus();

  // 1. Sovereign Gating (Suite-wide lock) takes precedence
  if (gated && status === 'red') {
    return <SovereignLock message={message} breachedPolicySlug={breachedPolicies[0]?.slug} />;
  }

  return (
    <>
      {/* 2. Advisory Alerts (Non-blocking) */}
      <div className="fixed top-20 right-6 z-[60] flex flex-col gap-3 pointer-events-none">
        {status === 'amber' && breachedPolicies.map((policy: any) => (
            <div key={policy.slug} className="pointer-events-auto">
                <SovereignAlert 
                    message={policy.driftMessage || `Regulatory drift detected in ${policy.name}`} 
                    policySlug={policy.slug} 
                />
            </div>
        ))}
      </div>

      {/* 3. Age Verification (App-specific compliance) */}
      {avRequired && (
        <AgeVerificationModal 
          onVerified={() => {
            console.log('[SovereignSentinel] Compliance Verified. Anchoring session...');
            setAvVerified(true);
          }} 
        />
      )}
    </>
  );
}
