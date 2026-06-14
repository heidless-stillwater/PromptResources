import * as fs from 'fs';
import * as path from 'path';

// Parse and load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1).replace(/\\n/g, '\n');
            }
            process.env[key] = value;
        }
    });
}

import { adminDb } from '../src/lib/firebase-admin';

async function main() {
    try {
        const snap = await adminDb.collection('playlists').get();
        console.log(`Total playlists in database: ${snap.size}`);
        snap.forEach(doc => {
            console.log(`ID: ${doc.id} | Title: "${doc.data().title}" | Status: ${doc.data().status}`);
        });
    } catch (e) {
        console.error(e);
    }
}

main();
