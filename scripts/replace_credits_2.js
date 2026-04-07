const fs = require('fs');

const files = [
    '/home/heidless/projects/PromptResources/src/app/globals.css',
    '/home/heidless/projects/PromptResources/src/app/resources/[id]/page.tsx',
    '/home/heidless/projects/PromptResources/src/app/admin/audit/youtube/page.tsx',
    '/home/heidless/projects/PromptResources/src/app/api-docs/page.tsx'
];

for (const file of files) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        
        content = content.replace(/CreditCard/g, '__CREDITCARD__');
        
        content = content.replace(/deduplicateCredits/g, 'deduplicateAttributions');
        content = content.replace(/resource\.credits/g, 'resource.attributions');
        content = content.replace(/ytCredit/g, 'ytAttribution');
        content = content.replace(/credits/g, 'attributions');
        content = content.replace(/Credits/g, 'Attributions');
        content = content.replace(/credit/g, 'attribution');
        content = content.replace(/Credit/g, 'Attribution');
        
        content = content.replace(/__CREDITCARD__/g, 'CreditCard');
        
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    } else {
        console.log(`File not found: ${file}`);
    }
}
