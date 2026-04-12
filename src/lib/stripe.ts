import Stripe from 'stripe';
import { getSecret } from './config-helper';

let stripeInstance: Stripe | null = null;

export async function getStripe() {
    if (!stripeInstance) {
        const apiKey = await getSecret('STRIPE_SECRET_KEY');
        if (!apiKey) {
            throw new Error('STRIPE_SECRET_KEY is missing from environment or database');
        }
        stripeInstance = new Stripe(apiKey, {
            apiVersion: '2024-06-20',
            typescript: true,
        });
    }
    return stripeInstance;
}
