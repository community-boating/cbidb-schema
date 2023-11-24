export const typeOverrides = {

};

export const calculations = {
	"PERSONS_MEMBERSHIPS": `
	override object calculations extends CalculationsObject {
		val isDiscountFrozen = new InitializableCastableToJs[Boolean](JsBoolean)
	}
	`,
	"PERSONS": `
	override object calculations extends CalculationsObject {
		val maxBoatFlags = new InitializableCastableToJs[IndexedSeq[MaxBoatFlag]](Json.toJson)
	}
	`
}