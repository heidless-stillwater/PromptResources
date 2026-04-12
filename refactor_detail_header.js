const fs = require('fs');

const file = 'src/app/resources/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. We will extract the detail-title-section
const startTitleMarker = '<div className="detail-title-section group">';
const startTitleIdx = content.indexOf(startTitleMarker);
if (startTitleIdx === -1) {
  console.log("Could not find start form marker");
  process.exit(1);
}

// Find the end of detail-title-section. It ends when we see the "Added By" section or detail-metadata
const endTitleMarker = '<div className="detail-metadata">';
const endTitleIdx = content.indexOf(endTitleMarker);
if (endTitleIdx === -1) {
    // maybe find where <div className="detail-actions"> ends
    console.log("Could not find detail metadata");
}

console.log("Title block starts at", startTitleIdx);
