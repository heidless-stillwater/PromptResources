const fs = require('fs');
const content = fs.readFileSync('/home/heidless/projects/PromptResources/src/app/resources/[id]/page.tsx', 'utf8');

let braceCount = 0;
let parenCount = 0;
let bracketCount = 0;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    else if (char === '(') parenCount++;
    else if (char === ')') parenCount--;
    else if (char === '[') bracketCount++;
    else if (char === ']') bracketCount--;
    
    if (braceCount < 0 || parenCount < 0 || bracketCount < 0) {
        console.log(`Negative count at index ${i} (char: ${char}): {${braceCount}}, (${parenCount}), [${bracketCount}]`);
        // We might want to see the context
        console.log(content.substring(Math.max(0, i-20), Math.min(content.length, i+20)));
        // Reset count to continue
        if (braceCount < 0) braceCount = 0;
        if (parenCount < 0) parenCount = 0;
        if (bracketCount < 0) bracketCount = 0;
    }
}

let tags = [];
const tagRegex = /<\/?([a-zA-Z0-9]+)/g;
let match;
while ((match = tagRegex.exec(content)) !== null) {
    const tagName = match[1];
    const isClosing = match[0].startsWith('</');
    
    // Ignore common TS types and uppercase-only (likely types)
    if (tagName === 'string' || tagName === 'number' || tagName === 'boolean' || tagName === 'any' || tagName === 'Set') continue;
    if (tagName.startsWith('HTML')) continue;
    
    if (isClosing) {
        const lastTag = tags.pop();
        if (lastTag !== tagName) {
            const context = content.substring(Math.max(0, match.index - 50), Math.min(content.length, match.index + 50));
            console.log(`Tag mismatch at ${match.index}: expected </${lastTag}> but found </${tagName}>`);
            console.log(`Context: ...${context}...`);
        }
    } else {
        const restOfTag = content.substring(match.index, content.indexOf('>', match.index) + 1);
        if (!restOfTag.endsWith('/>')) {
            tags.push(tagName);
        }
    }
}
console.log(`Remaining open tags: ${tags.join(', ')}`);
console.log(`Final counts: {${braceCount}}, (${parenCount}), [${bracketCount}]`);
