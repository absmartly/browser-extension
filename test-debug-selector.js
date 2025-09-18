// Debug script to test selector generation
const { JSDOM } = require('jsdom');
const fs = require('fs');

// Read the selector generator code
const selectorGeneratorCode = fs.readFileSync('src/utils/selector-generator-visual.ts', 'utf8');

// Extract just the functions we need (simplified for debugging)
const dom = new JSDOM(`
  <div id="container">
    <div id="dup-id">First</div>
    <div>
      <div id="dup-id">Second</div>
    </div>
  </div>
`);

const document = dom.window.document;
global.document = document;

// Simulate the selector generation
const first = document.querySelectorAll('#dup-id')[0];
console.log('Element:', first.textContent);
console.log('Element ID:', first.id);
console.log('Parent ID:', first.parentElement.id);

// Check duplicate IDs
const idMatches = document.querySelectorAll('#dup-id');
console.log('Elements with same ID:', idMatches.length);

// What selector would we expect?
console.log('\nExpected: #container #dup-id');
console.log('This should match only the first element');

const testSelector = '#container #dup-id';
const matches = document.querySelectorAll(testSelector);
console.log('Matches for "#container #dup-id":', matches.length);
console.log('First match is our element?', matches[0] === first);