"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const parsing_1 = require("../parsing");
const VERBS_ARRAY = '["Accomplishing","Calculating","Computing"]';
const SEARCH_TERM = 'Accomplishing';
const SEARCH_POS = VERBS_ARRAY.indexOf(SEARCH_TERM); // 2
suite('charType', () => {
    test('classifies letters', () => {
        assert_1.default.strictEqual((0, parsing_1.charType)('a'), 'letter');
        assert_1.default.strictEqual((0, parsing_1.charType)('Z'), 'letter');
    });
    test('classifies quote', () => assert_1.default.strictEqual((0, parsing_1.charType)('"'), 'quote'));
    test('classifies whitespace', () => {
        assert_1.default.strictEqual((0, parsing_1.charType)(' '), 'whitespace');
        assert_1.default.strictEqual((0, parsing_1.charType)('\t'), 'whitespace');
        assert_1.default.strictEqual((0, parsing_1.charType)('\n'), 'whitespace');
    });
    test('classifies comma', () => assert_1.default.strictEqual((0, parsing_1.charType)(','), 'comma'));
    test('classifies start bracket', () => assert_1.default.strictEqual((0, parsing_1.charType)('['), 'start'));
    test('classifies end bracket', () => assert_1.default.strictEqual((0, parsing_1.charType)(']'), 'end'));
    test('classifies other', () => {
        assert_1.default.strictEqual((0, parsing_1.charType)('{'), 'other');
        assert_1.default.strictEqual((0, parsing_1.charType)('1'), 'other');
    });
});
suite('isQuoted', () => {
    test('returns true when surrounded by quotes', () => {
        assert_1.default.strictEqual((0, parsing_1.isQuoted)('"hello"', 1, 'hello'), true);
    });
    test('returns false without surrounding quotes', () => {
        assert_1.default.strictEqual((0, parsing_1.isQuoted)('hello', 0, 'hello'), false);
    });
    test('returns false with only a leading quote', () => {
        assert_1.default.strictEqual((0, parsing_1.isQuoted)('"hello', 1, 'hello'), false);
    });
    test('returns false with only a trailing quote', () => {
        assert_1.default.strictEqual((0, parsing_1.isQuoted)('hello"', 0, 'hello'), false);
    });
});
suite('backtrackToStart', () => {
    test('finds the opening bracket when term is first element', () => {
        assert_1.default.strictEqual((0, parsing_1.backtrackToStart)(VERBS_ARRAY, SEARCH_POS), 0);
    });
    test('finds the opening bracket when term is a middle element', () => {
        const pos = VERBS_ARRAY.indexOf('Calculating');
        assert_1.default.strictEqual((0, parsing_1.backtrackToStart)(VERBS_ARRAY, pos), 0);
    });
    test('finds the opening bracket when term is the last element', () => {
        const pos = VERBS_ARRAY.indexOf('Computing');
        assert_1.default.strictEqual((0, parsing_1.backtrackToStart)(VERBS_ARRAY, pos), 0);
    });
    test('finds bracket when array is embedded in surrounding content', () => {
        const content = 'var x=' + VERBS_ARRAY + ';';
        const pos = content.indexOf(SEARCH_TERM);
        assert_1.default.strictEqual((0, parsing_1.backtrackToStart)(content, pos), 6); // index of '['
    });
    test('returns -1 when there is no valid array start', () => {
        assert_1.default.strictEqual((0, parsing_1.backtrackToStart)('foo bar', 4), -1);
    });
});
suite('forwardTrackToEnd', () => {
    test('finds the closing bracket when term is first element', () => {
        assert_1.default.strictEqual((0, parsing_1.forwardTrackToEnd)(VERBS_ARRAY, SEARCH_POS), VERBS_ARRAY.length - 1);
    });
    test('finds the closing bracket when term is a middle element', () => {
        const pos = VERBS_ARRAY.indexOf('Calculating');
        assert_1.default.strictEqual((0, parsing_1.forwardTrackToEnd)(VERBS_ARRAY, pos), VERBS_ARRAY.length - 1);
    });
    test('finds the closing bracket when term is the last element', () => {
        const pos = VERBS_ARRAY.indexOf('Computing');
        assert_1.default.strictEqual((0, parsing_1.forwardTrackToEnd)(VERBS_ARRAY, pos), VERBS_ARRAY.length - 1);
    });
    test('returns -1 when there is no valid array end', () => {
        assert_1.default.strictEqual((0, parsing_1.forwardTrackToEnd)('foo bar', 0), -1);
    });
});
suite('backtrackToStart + forwardTrackToEnd round-trip', () => {
    test('extracts the exact array slice from surrounding content', () => {
        const content = 'var x=' + VERBS_ARRAY + ';var y=1;';
        const pos = content.indexOf(SEARCH_TERM);
        const start = (0, parsing_1.backtrackToStart)(content, pos);
        const end = (0, parsing_1.forwardTrackToEnd)(content, pos);
        assert_1.default.strictEqual(content.slice(start, end + 1), VERBS_ARRAY);
    });
});
//# sourceMappingURL=parsing.test.js.map