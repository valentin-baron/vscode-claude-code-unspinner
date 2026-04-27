export type CharType = 'letter' | 'quote' | 'whitespace' | 'comma' | 'start' | 'end' | 'other';
export interface CharRule {
	[key: string]: CharType[] | CharRule;
}

export function charType(char: string): CharType {
	if (/[a-zA-Z]/.test(char)) { return 'letter'; }
	if (char === '"') { return 'quote'; }
	if (/\s/.test(char)) { return 'whitespace'; }
	if (char === ',') { return 'comma'; }
	if (char === '[') { return 'start'; }
	if (char === ']') { return 'end'; }
	return 'other';
}

export function isQuoted(content: string, position: number, term: string): boolean {
	return content[position - 1] === '"' && content[position + term.length] === '"';
}

export function isAllowedChar(current: CharType, previous: CharType, prev2: CharType, rule: CharRule): boolean {
	try {
		const currentRule = rule[previous];
		if (Array.isArray(currentRule)) {
			return currentRule.includes(current);
		} else if (currentRule) {
			const subRule = currentRule[prev2];
			if (Array.isArray(subRule)) {
				return subRule.includes(current);
			}
		}
	} catch {
		// i dont want it to crash ¯\_(ツ)_/¯
	}
	return false;
}

export const BackwardsRule: CharRule = {
	letter: ['letter', 'quote'],
	quote: {
		letter: ['whitespace', 'comma', 'start'], // <, "A>
		whitespace: ['letter'], // <a" >
		comma: ['letter'], // <a",>
	},
	whitespace: ['comma', 'whitespace', 'quote', 'start'],
	comma: ['quote', 'whitespace'],
};

export const ForwardsRule: CharRule = {
	letter: ['letter', 'quote'],
	quote: {
		letter: ['whitespace', 'comma', 'end'], // <a",>
		whitespace: ['letter'], // < "A>
		comma: ['letter'], // <,"A>
	},
	comma: ['quote', 'whitespace'],
	whitespace: ['whitespace', 'comma', 'quote', 'end'],
};

export function backtrackToStart(content: string, position: number): number {
	let previousCharType = charType(content[position]);
	let prev2CharType = charType(content[position + 1]);
	do {
		position--;
		const currentCharType = charType(content[position]);
		if (!isAllowedChar(currentCharType, previousCharType, prev2CharType, BackwardsRule)) {
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

export function forwardTrackToEnd(content: string, position: number): number {
	let previousCharType = charType(content[position]);
	let prev2CharType = charType(content[position - 1]);
	do {
		position++;
		const currentCharType = charType(content[position]);
		if (!isAllowedChar(currentCharType, previousCharType, prev2CharType, ForwardsRule)) {
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