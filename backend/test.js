import { extractVideoId, chunkText } from './services/transcript.js';
import { topPassages } from './services/rag.js';

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${desc}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✗\x1b[0m ${desc}`);
    failed++;
  }
}

console.log('\n--- 1. Testing extractVideoId ---');
assert('extracts from standard watch url', extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
assert('extracts from youtu.be short url', extractVideoId('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
assert('extracts from embed url', extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
assert('extracts from shorts url', extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
assert('extracts from live url', extractVideoId('https://www.youtube.com/live/dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
assert('extracts with query params and timestamps', extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&feature=share') === 'dQw4w9WgXcQ');
assert('accepts raw 11-char video ID', extractVideoId('dQw4w9WgXcQ') === 'dQw4w9WgXcQ');
assert('returns null on non-youtube link', extractVideoId('https://vimeo.com/12345678') === null);
assert('returns null on empty input', extractVideoId('') === null);

console.log('\n--- 2. Testing chunkText ---');
const sampleWords = 'Database normalization is the process of structuring a relational database in accordance with normal forms.';
const singleChunk = chunkText(sampleWords, 500);
assert('returns 1 chunk if shorter than size', singleChunk.length === 1 && singleChunk[0] === sampleWords);

const longText = Array(100).fill('ACID transaction atomicity consistency isolation durability in DBMS.').join(' ');
const multiChunks = chunkText(longText, 500);
assert('splits long text into multiple chunks', multiChunks.length > 5);
assert('chunks do not break words', multiChunks.every(c => !c.startsWith(' ') && !c.endsWith(' ')));

console.log('\n--- 3. Testing topPassages (BM25 Retriever) ---');
const sampleTranscript = `
Welcome to lecture 4 on database management systems.
Today we cover normalization and normal forms including 1NF, 2NF, 3NF, and Boyce Codd Normal Form BCNF.
A relation is in BCNF if for every functional dependency X determines Y, X is a superkey.
This eliminates redundancy and prevents update anomalies.

In the next part of this lecture, we discuss query optimization and B-Tree indexing.
A B-Tree is a self-balancing search tree used in storage engines to allow logarithmic search, insertions, and deletions.
Clustered index stores rows physically in order while secondary index holds pointers.

Finally we review ACID properties of transactions.
Atomicity means all or nothing.
Consistency preserves database invariants.
Isolation ensures concurrent transactions execute without interfering.
Durability guarantees committed changes survive system crashes.
`.trim();

const bcnfResult = topPassages(sampleTranscript, 'What is Boyce Codd normal form BCNF?');
assert('retrieves relevant passage for BCNF query', bcnfResult.length > 0 && bcnfResult[0].includes('BCNF'));

const acidResult = topPassages(sampleTranscript, 'Explain ACID atomicity and durability');
assert('retrieves relevant passage for ACID query', acidResult.length > 0 && acidResult[0].includes('Atomicity'));

const irrelevantResult = topPassages(sampleTranscript, 'Explain quantum entanglement and qubits in physics');
assert('returns empty list for completely irrelevant query', irrelevantResult.length === 0);

assert('handles null or empty transcript safely', topPassages(null, 'test').length === 0);
assert('handles empty query safely', topPassages(sampleTranscript, '').length === 0);

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
