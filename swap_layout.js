const fs = require('fs');
const file = 'src/app/resources/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// The marker for Breadcrumb
const breadcrumbMarker = '                    {/* Breadcrumb & Global Actions */}';
// The marker for detail layout
const layoutMarker = '                    <div className="detail-layout animate-slide-up">';
// The marker for media section
const mediaMarker = '                            {/* Media Section */}';
// The marker for title section
const titleMarker = '                            <div className="detail-title-section group">';
// The marker for sidebar
const sidebarMarker = '                            {/* SIDEBAR */}';
const detailSidebarHtmlMarker = '                        <div className="detail-sidebar">';

const parts = content.split('\n');
console.log("Found breadcrumb at", parts.findIndex(l => l.includes('{/* Breadcrumb & Global Actions */}')));
console.log("Found layoutMarker at", parts.findIndex(l => l.includes('<div className="detail-layout animate-slide-up">')));
console.log("Found mediaMarker at", parts.findIndex(l => l.includes('{/* Media Section */}')));
console.log("Found titleMarker at", parts.findIndex(l => l.includes('<div className="detail-title-section group">')));
console.log("Found sidebarMarker at", parts.findIndex(l => l.includes('<div className="detail-sidebar">')));
