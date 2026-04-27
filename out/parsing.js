"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForwardsRule = exports.BackwardsRule = void 0;
exports.charType = charType;
exports.isQuoted = isQuoted;
exports.isAllowedChar = isAllowedChar;
exports.backtrackToStart = backtrackToStart;
exports.forwardTrackToEnd = forwardTrackToEnd;
function charType(char) {
    if (/[a-zA-Z]/.test(char)) {
        return 'letter';
    }
    if (char === '"') {
        return 'quote';
    }
    if (/\s/.test(char)) {
        return 'whitespace';
    }
    if (char === ',') {
        return 'comma';
    }
    if (char === '[') {
        return 'start';
    }
    if (char === ']') {
        return 'end';
    }
    return 'other';
}
function isQuoted(content, position, term) {
    return content[position - 1] === '"' && content[position + term.length] === '"';
}
function isAllowedChar(current, previous, prev2, rule) {
    const currentRule = rule[previous];
    if (Array.isArray(currentRule)) {
        return currentRule.includes(current);
    }
    else if (currentRule) {
        const subRule = currentRule[prev2];
        if (Array.isArray(subRule)) {
            return subRule.includes(current);
        }
    }
    return false;
}
exports.BackwardsRule = {
    letter: ['letter', 'quote'],
    quote: {
        letter: ['whitespace', 'comma', 'start'], // <, "A>
        whitespace: ['letter'], // <a" >
        comma: ['letter'], // <a",>
    },
    whitespace: ['comma', 'whitespace', 'quote', 'start'],
    comma: ['quote', 'whitespace'],
};
exports.ForwardsRule = {
    letter: ['letter', 'quote'],
    quote: {
        letter: ['whitespace', 'comma', 'end'], // <a",>
        whitespace: ['letter'], // < "A>
        comma: ['letter'], // <,"A>
    },
    comma: ['quote', 'whitespace'],
    whitespace: ['whitespace', 'comma', 'quote', 'end'],
};
function backtrackToStart(content, position) {
    let previousCharType = charType(content[position]);
    let prev2CharType = charType(content[position + 1]);
    do {
        position--;
        const currentCharType = charType(content[position]);
        if (!isAllowedChar(currentCharType, previousCharType, prev2CharType, exports.BackwardsRule)) {
            break;
        }
        if (currentCharType === 'start') {
            return position;
        }
        prev2CharType = previousCharType;
        previousCharType = currentCharType;
    } while (position > 0);
    return -1;
}
function forwardTrackToEnd(content, position) {
    let previousCharType = charType(content[position]);
    let prev2CharType = charType(content[position - 1]);
    do {
        position++;
        const currentCharType = charType(content[position]);
        if (!isAllowedChar(currentCharType, previousCharType, prev2CharType, exports.ForwardsRule)) {
            break;
        }
        if (currentCharType === 'end') {
            return position;
        }
        prev2CharType = previousCharType;
        previousCharType = currentCharType;
    } while (position < content.length);
    return -1;
}
//# sourceMappingURL=parsing.js.map