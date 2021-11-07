export const fromUpperSnake = (s: string) => s.split("_").map(ss => ss.toLowerCase());

export const toCamelCase = (words: string[]) => ([words[0]].concat(words.slice(1).map(capitalize))).join("")

export const toCamelCaseLeadCap = (words: string[]) => (words.map(capitalize)).join("")

export const depluralize = (s: string) => {
	if (s.substr(s.length-1).toLowerCase() == "s") {
		return s.substring(0, s.length-1);
	} else return s;
}

const capitalize = (s: string) => s.substr(0,1).toUpperCase() + s.substr(1);