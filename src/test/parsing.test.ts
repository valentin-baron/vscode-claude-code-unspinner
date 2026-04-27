import assert from 'assert';
import { charType, isQuoted, backtrackToStart, forwardTrackToEnd } from '../parsing';

const VERBS_ARRAY = '["Accomplishing","Calculating","Computing"]';
const SEARCH_TERM = 'Accomplishing';
const SEARCH_POS = VERBS_ARRAY.indexOf(SEARCH_TERM); // 2

suite('charType', () => {
	test('classifies letters', () => {
		assert.strictEqual(charType('a'), 'letter');
		assert.strictEqual(charType('Z'), 'letter');
	});
	test('classifies quote', () => assert.strictEqual(charType('"'), 'quote'));
	test('classifies whitespace', () => {
		assert.strictEqual(charType(' '), 'whitespace');
		assert.strictEqual(charType('\t'), 'whitespace');
		assert.strictEqual(charType('\n'), 'whitespace');
	});
	test('classifies comma', () => assert.strictEqual(charType(','), 'comma'));
	test('classifies start bracket', () => assert.strictEqual(charType('['), 'start'));
	test('classifies end bracket', () => assert.strictEqual(charType(']'), 'end'));
	test('classifies other', () => {
		assert.strictEqual(charType('{'), 'other');
		assert.strictEqual(charType('1'), 'other');
	});
});

suite('isQuoted', () => {
	test('returns true when surrounded by quotes', () => {
		assert.strictEqual(isQuoted('"hello"', 1, 'hello'), true);
	});
	test('returns false without surrounding quotes', () => {
		assert.strictEqual(isQuoted('hello', 0, 'hello'), false);
	});
	test('returns false with only a leading quote', () => {
		assert.strictEqual(isQuoted('"hello', 1, 'hello'), false);
	});
	test('returns false with only a trailing quote', () => {
		assert.strictEqual(isQuoted('hello"', 0, 'hello'), false);
	});
});

suite('backtrackToStart', () => {
	test('finds the opening bracket when term is first element', () => {
		assert.strictEqual(backtrackToStart(VERBS_ARRAY, SEARCH_POS), 0);
	});
	test('finds the opening bracket when term is a middle element', () => {
		const pos = VERBS_ARRAY.indexOf('Calculating');
		assert.strictEqual(backtrackToStart(VERBS_ARRAY, pos), 0);
	});
	test('finds the opening bracket when term is the last element', () => {
		const pos = VERBS_ARRAY.indexOf('Computing');
		assert.strictEqual(backtrackToStart(VERBS_ARRAY, pos), 0);
	});
	test('finds bracket when array is embedded in surrounding content', () => {
		const content = 'var x=' + VERBS_ARRAY + ';';
		const pos = content.indexOf(SEARCH_TERM);
		assert.strictEqual(backtrackToStart(content, pos), 6); // index of '['
	});
	test('returns -1 when there is no valid array start', () => {
		assert.strictEqual(backtrackToStart('foo bar', 4), -1);
	});
});

suite('forwardTrackToEnd', () => {
	test('finds the closing bracket when term is first element', () => {
		assert.strictEqual(forwardTrackToEnd(VERBS_ARRAY, SEARCH_POS), VERBS_ARRAY.length - 1);
	});
	test('finds the closing bracket when term is a middle element', () => {
		const pos = VERBS_ARRAY.indexOf('Calculating');
		assert.strictEqual(forwardTrackToEnd(VERBS_ARRAY, pos), VERBS_ARRAY.length - 1);
	});
	test('finds the closing bracket when term is the last element', () => {
		const pos = VERBS_ARRAY.indexOf('Computing');
		assert.strictEqual(forwardTrackToEnd(VERBS_ARRAY, pos), VERBS_ARRAY.length - 1);
	});
	test('returns -1 when there is no valid array end', () => {
		assert.strictEqual(forwardTrackToEnd('foo bar', 0), -1);
	});
});

suite('backtrackToStart + forwardTrackToEnd round-trip', () => {
	test('extracts the exact array slice from surrounding content', () => {
		const content = 'var x=' + VERBS_ARRAY + ';var y=1;';
		const pos = content.indexOf(SEARCH_TERM);
		const start = backtrackToStart(content, pos);
		const end = forwardTrackToEnd(content, pos);
		assert.strictEqual(content.slice(start, end + 1), VERBS_ARRAY);
	});
});
