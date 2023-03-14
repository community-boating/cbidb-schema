export default class StringBuilder {
	EOL = "\n"
	TAB = "\t"
	baseIndentLevel = 0

	out = ""

	justNewlined = false

	public indent(ct: number) {
		if (!this.justNewlined) return;
		for (var i=0; i<(ct+this.baseIndentLevel); i++) this.out += "\t"
	}

	public append(s: string, indentCt: number=0) {
		this.indent(indentCt)
		this.out += s;
		this.justNewlined = false;
	}

	public appendLine(s: string = "", indentCt: number=0) {
		this.indent(indentCt)
		this.out += s + this.EOL;
		this.justNewlined = true;
	}

	public setBaseIndentLevel(l: number) {
		this.baseIndentLevel = l;
	}

	public toString() {
		return this.out;
	}
}