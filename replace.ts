import fs from 'fs';

let content = fs.readFileSync('src/components/Chat.tsx', 'utf8');

content = content.replace(/text-emerald-500/g, 'text-primary');
content = content.replace(/bg-emerald-500/g, 'bg-primary');
content = content.replace(/bg-emerald-600/g, 'bg-primary-hover');
content = content.replace(/hover:bg-emerald-500/g, 'hover:bg-primary');
content = content.replace(/text-emerald-400/g, 'text-primary-text');
content = content.replace(/border-emerald-500\/20/g, 'border-primary-border');
content = content.replace(/border-emerald-500\/10/g, 'border-primary-border');
content = content.replace(/border-emerald-500\/30/g, 'border-primary-border');
content = content.replace(/border-emerald-500\/50/g, 'border-primary');
content = content.replace(/border-emerald-400\/20/g, 'border-primary-border');
content = content.replace(/shadow-emerald-900\/20/g, 'shadow-primary-glow');
content = content.replace(/shadow-emerald-500\/10/g, 'shadow-primary-glow');
content = content.replace(/bg-emerald-500\/10/g, 'bg-primary-bg');
content = content.replace(/bg-emerald-500\/5/g, 'bg-primary-bg');
content = content.replace(/bg-emerald-600\/90/g, 'bg-primary-hover/90');
content = content.replace(/bg-emerald-500\/50/g, 'bg-primary/50');
content = content.replace(/text-emerald-500\/50/g, 'text-primary/50');
content = content.replace(/text-emerald-500\/80/g, 'text-primary/80');
content = content.replace(/text-emerald-400\/80/g, 'text-primary-text/80');
content = content.replace(/ring-emerald-500\/50/g, 'ring-primary/50');
content = content.replace(/selection:bg-emerald-500\/30/g, 'selection:bg-primary/30');
content = content.replace(/prose-emerald/g, 'prose-primary');
content = content.replace(/hover:text-emerald-500/g, 'hover:text-primary');

fs.writeFileSync('src/components/Chat.tsx', content);
console.log('Replaced emerald classes');
