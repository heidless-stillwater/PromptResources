import { ComplianceService } from './src/lib/services/compliance-service';

async function test() {
    console.log('Testing Sovereign Gate for DPA-RED...');
    const result = await ComplianceService.verifySovereignGate();
    console.log('Result:', JSON.stringify(result, null, 2));
}

test();
