export const typeOverrides = {

};

export const calculations = {
	"JP_CLASS_INSTANCES": `
	override object calculations extends CalculationsObject {
		lazy val firstSession: JpClassSession = references.jpClassSessions.get.sortWith((a: JpClassSession, b: JpClassSession) => {
			a.values.sessionDatetime.get.isBefore(b.values.sessionDatetime.get)
		}).head
	}
	`,
	"JP_CLASS_SESSIONS": `
	override object calculations extends CalculationsObject {
		val weekAlias = new Initializable[Option[String]]
	}
	`,
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