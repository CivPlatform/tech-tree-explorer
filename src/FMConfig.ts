import YAML from 'js-yaml'

export type Factory = {
	/** name is used as identifier, e.g. when referred to in upgrade recipes */
	name: string
	recipes: Map<string, Recipe>
} & (
	| { type: 'FCC'; setupCost: ItemCounts }
	| { type: 'FCCUPGRADE'; upgradeRecipe: UpgradeRecipe }
)

export type Recipe = {
	/** e.g. `upgrade_to_adv_ore_smelter` */
	id: string
	/** e.g. `Upgrade to Advanced Ore Smelter` */
	name: string
	/** where this recipe can be run */
	factories: Factory[]
	/** `production_time` in config.yml */
	runSec: number
	/** `fuel_consumption_intervall` in config.yml */
	fuelConsumeSec: number
} & (
	| { type: 'PRODUCTION'; input: ItemCounts; output: ItemCounts }
	| { type: 'UPGRADE'; input: ItemCounts; upgradesToFactory: Factory }
	| { type: 'REPAIR'; input: ItemCounts; health_gained: number }
	| { type: 'COMPACT' | 'DECOMPACT'; input: ItemCounts; compact_lore: string }
	// | { type: 'RANDOM'; input: ItemCounts; outputs: { chance: number; items: ItemCounts }[] }
	// | { type: 'WORDBANK' }
	// | { type: 'PRINTINGPLATE'; input: ItemCounts; output: ItemCounts }
	// | { type: 'PRINTINGPLATEJSON'; input: ItemCounts; output: ItemCounts }
	// | { type: 'PRINTBOOK'; input: ItemCounts; printingplate: ItemCounts }
	// | { type: 'PRINTNOTE'; input: ItemCounts; printingplate: ItemCounts }
	| { type: 'TODO' }
)

export type UpgradeRecipe = Recipe & { type: 'UPGRADE' }

export type ItemCounts = Map<string, number>

export class Item {
	/** combination of material, customName, and lore */
	id: string

	madeInRecipes: Recipe[] = []
	usedInRecipes: Recipe[] = []
	usedInFactoryCreations: Factory[] = []

	constructor(
		readonly material: string,
		readonly customName?: string,
		readonly lore?: string[]
	) {
		this.id = [material, customName || '', ...(lore || [])].join('\n').trim()
	}

	get isCompacted() {
		return this.lore?.length === 1 && this.lore[0] === 'Compacted Item'
	}

	decompactedCount(count: number) {
		// TODO smaller stack sizes for tools, potions, etc.
		return this.isCompacted ? count * 64 : count
	}

	static getMaterialFromId(id: string) {
		return id.split('\n')[0]
	}
}

/**
 * - convenient: replaces identifiers with instances, adds bidirectional lookups
 * - safe: detects unexpected values
 */
export class FMConfig {
	/** by id, e.g. "upgrade_to_adv_ore_smelter" */
	recipes: NodeJS.Dict<Recipe> = {}
	/** by name, e.g. "Advanced Ore Smelter" */
	factories: NodeJS.Dict<Factory> = {}
	/** by material then id; e.g. "sponge" > "sponge\nBastion\nThis bastion will ..." */
	recipeItems: NodeJS.Dict<NodeJS.Dict<Item>> = {}

	defaultFuelConsumeSec: number

	getItemOrCreateFromYaml(itemYaml: any): Item {
		const item = parseItem(itemYaml)
		const byMat = getOrSet(this.recipeItems, item.material, {})
		return getOrSet(byMat, item.id, item)
	}

	getItemForId(id: string) {
		const material = Item.getMaterialFromId(id)
		return this.recipeItems[material]?.[id]
	}

	parseErrors: { err: unknown; msg: string; context: any }[] = []

	handleParseError(err: unknown, msg: string, context: any) {
		console.error(msg, context, err)
		this.parseErrors.push({ err, msg, context })
	}

	constructor(yamlText: string) {
		const yaml = YAML.load(yamlText) as any

		this.defaultFuelConsumeSec = parseDuration(
			yaml.default_fuel_consumption_intervall
		)

		/** by factory name */
		const upgradeRecipes: NodeJS.Dict<UpgradeRecipe> = {}

		for (const [recipeId, recipeYaml] of Object.entries(yaml.recipes) as any) {
			try {
				const recipe = parseRecipe(recipeYaml, recipeId, this)
				if (!recipe) continue
				this.recipes[recipeId] = recipe
				if ('input' in recipe) {
					for (const itemId of Array.from(recipe.input.keys())) {
						this.getItemForId(itemId)!.usedInRecipes.push(recipe)
					}
				}
				if ('output' in recipe) {
					for (const itemId of Array.from(recipe.output.keys())) {
						this.getItemForId(itemId)!.madeInRecipes.push(recipe)
					}
				}
				if (recipe.type === 'UPGRADE') {
					upgradeRecipes[checkStr(recipeYaml.factory)] = recipe
				}
			} catch (err) {
				this.handleParseError(err, `Failed parsing recipe`, recipeYaml)
			}
		}

		for (const factoryYaml of Object.values(yaml.factories) as any) {
			try {
				const factory = parseFactory(factoryYaml, this)
				this.factories[factory.name] = factory
				for (const recipeId of factoryYaml.recipes) {
					const recipe = this.recipes[checkStr(recipeId)]
					if (!recipe) throw new Error(`No such recipe '${recipeId}'`)
					recipe.factories.push(factory)
					factory.recipes.set(recipe.id, recipe)
				}

				const upgradeRecipe = upgradeRecipes[factory.name]
				if (upgradeRecipe) {
					if (factory.type === 'FCCUPGRADE') {
						factory.upgradeRecipe = upgradeRecipe
						upgradeRecipe.upgradesToFactory = factory
					} else
						throw new Error(`Cannot upgrade to factory type '${factory.type}'`)
				} else if (factory.type === 'FCCUPGRADE') {
					throw new Error(`Found no upgrade recipe to this factory`)
				}
			} catch (err) {
				this.handleParseError(err, `Failed parsing factory`, factoryYaml)
			}
		}
	}
}

function parseFactory(yaml: any, fmConfig: FMConfig): Factory {
	const type = checkStr(yaml.type)
	const name = checkStr(yaml.name)
	switch (type) {
		case 'FCC':
			const setupCost = parseItemCounts(yaml.setupcost, fmConfig)
			const factory = { type, name, setupCost, recipes: new Map() }
			for (const itemId of Array.from(setupCost.keys())) {
				fmConfig.getItemForId(itemId)!.usedInFactoryCreations.push(factory)
			}
			return factory
		case 'FCCUPGRADE':
			const upgradeRecipe = null! // will be set later
			return { type, name, upgradeRecipe, recipes: new Map() }
		default:
			throw new Error(`Unknown factory type '${type}'`)
	}
}

function parseRecipe(
	yaml: any,
	recipeId: string,
	fmConfig: FMConfig
): Recipe | null {
	const base = {
		id: recipeId,
		name: checkStr(yaml.name),
		factories: [],
		runSec: parseDuration(yaml.production_time),
		fuelConsumeSec: yaml.fuel_consumption_intervall
			? parseDuration(yaml.fuel_consumption_intervall)
			: fmConfig.defaultFuelConsumeSec,
	}
	const input = () => parseItemCounts(yaml.input, fmConfig)
	const type = checkStr(yaml.type)
	switch (type) {
		case 'PRODUCTION': {
			const output = parseItemCounts(yaml.output, fmConfig)
			return { ...base, type, input: input(), output }
		}
		case 'UPGRADE': {
			return { ...base, type, input: input(), upgradesToFactory: null! }
		}
		case 'REPAIR': {
			const health_gained = checkNum(yaml.health_gained)
			return { ...base, type, input: input(), health_gained }
		}
		case 'COMPACT':
		case 'DECOMPACT': {
			const compact_lore = checkStr(yaml.compact_lore)
			return { ...base, type, input: input(), compact_lore }
		}
		case 'RANDOM':
		case 'WORDBANK':
		case 'PRINTINGPLATE':
		case 'PRINTINGPLATEJSON':
		case 'PRINTBOOK':
		case 'PRINTNOTE':
		case 'HELIODOR_CREATE':
		case 'HELIODOR_REFILL':
		case 'HELIODOR_FINISH':
			return { ...base, type: 'TODO' }
		default:
			throw new Error(`Unknown recipe type ${type}`)
	}
}

function parseItemCounts(yaml: any, fmConfig: FMConfig): ItemCounts {
	const items: ItemCounts = new Map()
	if (yaml === null) return items
	if (typeof yaml !== 'object') {
		throw new Error(`Invalid items: '${yaml}'`)
	}
	for (const itemYaml of Object.values(yaml) as any) {
		const amount = itemYaml.amount === undefined ? 1 : checkNum(itemYaml.amount)
		const item = fmConfig.getItemOrCreateFromYaml(itemYaml)
		items.set(item.id, amount)
	}
	return items
}

const customItems: NodeJS.Dict<Item> = {
	"backpack": new Item("ender_chest", "Backpack", ["Can be placed and used like an ender chest,","but drops its items when you die","Cannot contain certain PvP items"]),
	"meteoric_iron_nugget": new Item("iron_nugget", "Meteoric Iron Nugget", ["A buried fragment from another world","Used for its unique magical properties"]),
	"meteoric_iron_ingot": new Item("heavy_weighted_pressure_plate", "Meteoric Iron Ingot", ["A buried fragment from another world","Used for its unique magical properties"]),
	"factory_upgrade": new Item("redstone_torch", "Factory Upgrade", ["Factories can be upgraded with one of two paths","Charcoal consumption: 1/4 -> 1/8 -> 1/12 -> 1/16","Factory speed: x2 -> x3 -> x4 -> x5"]),
	"meteoric_iron_helmet": new Item("iron_helmet", "Meteoric Iron Helmet"),
	"meteoric_iron_chestplate": new Item("iron_chestplate", "Meteoric Iron Chestplate"),
	"meteoric_iron_leggings": new Item("iron_leggings", "Meteoric Iron Leggings"),
	"meteoric_iron_boots": new Item("iron_boots", "Meteoric Iron Boots"),
	"meteoric_iron_pickaxe_silk": new Item("iron_pickaxe", "Meteoric Iron Pickaxe", ["Instantly breaks deepslate and stone,","and otherwise equivalent to diamond"]),
	"meteoric_iron_pickaxe": new Item("iron_pickaxe", "Meteoric Iron Pickaxe", ["Instantly breaks deepslate and stone,","and otherwise equivalent to diamond"]),
	"meteoric_iron_axe_silk": new Item("iron_axe", "Meteoric Iron Axe", ["Deals 2.5x reinforcement damage on wood products","Deals 2x reinforcement damage on iron and copper products"]),
	"meteoric_iron_axe": new Item("iron_axe", "Meteoric Iron Axe", ["Deals 2.5x reinforcement damage on wood products","Deals 2x reinforcement damage on iron and copper products"]),
	"meteoric_iron_sword_knockback": new Item("iron_sword", "Meteoric Iron Sword", ["Deals 1 second of Slowness I on hit","Instantly breaks cobwebs"]),
	"meteoric_iron_sword_knockback1": new Item("iron_sword", "Meteoric Iron Sword", ["Deals 1 second of Slowness I on hit","Instantly breaks cobwebs"]),
	"meteoric_iron_sword": new Item("iron_sword", "Meteoric Iron Sword", ["Deals 1 second of Slowness I on hit","Instantly breaks cobwebs"])
}

function parseItem(yaml: any): Item {
	if (typeof yaml !== 'object') {
		throw new Error(`Invalid item: '${yaml}'`)
	}
	if (yaml["custom-key"]) return customItems[yaml["custom-key"]]!
	const material = checkStr(yaml.type).toLowerCase()
	const customName = yaml.meta?.["display-name"] ? checkStr(yaml.meta["display-name"]) : undefined
	const lore = yaml.meta?.lore
	return new Item(material, customName, lore)
}

function parseDuration(s: string): number {
	const match = /(\d+)(\S+)/.exec(s)
	if (!match) {
		throw new Error(`Invalid duration: '${s}'`)
	}
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [_fullmatch, n, unit] = match
	const units: { [u: string]: number } = { s: 1 }
	return +n * units[unit]
}

function checkStr(s: unknown): string {
	if (typeof s !== 'string') {
		throw new Error(`Not a string: '${s}'`)
	}
	return s
}

function checkNum(n: unknown): number {
	if (typeof n !== 'number') {
		throw new Error(`Not a number: '${n}'`)
	}
	return n
}

function getOrSet<V>(map: NodeJS.Dict<V>, k: string, v: V): V {
	const existing = map[k]
	if (existing) return existing
	map[k] = v
	return v
}
