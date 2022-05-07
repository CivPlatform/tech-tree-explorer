import { createContext, useContext, useMemo, useState } from 'react'
import {
	BrowserRouter as Router,
	Link,
	Route,
	Routes,
	useParams,
} from 'react-router-dom'
import useSWRImmutable from 'swr/immutable'
import './App.css'
import { Factory, FMConfig, Item, ItemCounts, Recipe } from './FMConfig'
import { ItemIcon, useItemInfos } from './ItemIcon'

const configUrlCivClassic =
	'https://raw.githubusercontent.com/CivClassic/AnsibleSetup/master/templates/public/plugins/FactoryMod/config.yml.j2'

const FMConfigContext = createContext<FMConfig>(undefined!)

/** loads FM config, routes pages */
export function App() {
	const [configUrl] = useState(configUrlCivClassic)

	const {
		data: fmConfig,
		error,
		isValidating: isLoading,
	} = useSWRImmutable(configUrl, (url) =>
		fetch(url)
			.then((r) => r.text())
			.then((yaml) => new FMConfig(yaml))
	)

	return (
		<div className="App">
			<Router>
				{fmConfig ? (
					<FMConfigContext.Provider value={fmConfig}>
						<PagesSwitch />
					</FMConfigContext.Provider>
				) : error && !isLoading ? (
					<div className="Page centerhv">
						<pre>{String(error)}</pre>
					</div>
				) : (
					<div className="Page centerhv">Loading config ...</div>
				)}
			</Router>
		</div>
	)
}

const PagesSwitch = () => (
	<Routes>
		<Route path="/" element={<MainPage />} />
		<Route path="/factories" element={<FactoriesPage />} />
		<Route path="/factories/:slug" element={<FactoryPage />} />
		<Route path="/recipes" element={<RecipesPage />} />
		<Route path="/recipes/:id" element={<RecipePage />} />
		<Route path="/items" element={<ItemsPage />} />
		<Route path="/items/:material" element={<ItemPage />} />
		<Route path="/items/:material/:customName" element={<ItemPage />} />
		<Route path="*" element={<UnknownPage />} />
	</Routes>
)

function TopBar() {
	return (
		<div className="TopBar">
			<div className="TopBar-Middle">
				{/* XXX placeholders */}
				<Link to="/factories">Factories</Link>
				<Link to="/recipes">Recipes</Link>
				<Link to="/items">Items</Link>

				<Link to="/factories/Ore_Smelter">Ore Smelter</Link>
				<Link to="/factories/Advanced_Ore_Smelter">Advanced Ore Smelter</Link>
				<Link to="/factories/Compactor">Compactor</Link>

				<Link to="/items/sand">Sand</Link>
				<Link to="/items/sponge/Bastion">Bastion</Link>
				<Link to="/items/diamond/Refractor">Refractor</Link>

				<Link to="/recipes/wither_skull">Forge Nether Star</Link>
			</div>
		</div>
	)
}

function MainPage() {
	return (
		<div className="Page">
			<TopBar />
			<div className="Page-Content centerhv">Main Page! TODO</div>
		</div>
	)
}

const UnknownPage = () => (
	<div className="Page">
		<TopBar />
		<div className="Page-Content centerhv">
			Page not found.
			<br />
			<Link to="/">Go to Main Page</Link>
		</div>
	</div>
)

const mkFacPath = (fac: Factory) =>
	`/factories/${fac.name.replaceAll(' ', '_')}`

function FactoryPage() {
	const { slug = '' } = useParams()
	const name = slug?.replaceAll('_', ' ')
	const fmConfig = useContext(FMConfigContext)

	const factory = fmConfig.factories[name]
	if (!factory)
		return <div className="Page centerhv">Error: No such factory: {name}</div>

	return (
		<div className="Page">
			<TopBar />
			<div className="Page-Content">
				<h3>{name}</h3>
				{factory.type === 'FCC' ? (
					<>
						<h4>Setup Cost</h4>
						<ItemCountsTable itemCounts={factory.setupCost} />
					</>
				) : factory.type === 'FCCUPGRADE' ? (
					<>
						<h4>Upgrade Recipe</h4>
						<p>
							Upgrade from:{' '}
							<FactoryListInline factories={factory.upgradeRecipe.factories} />
						</p>
						<ItemCountsTable itemCounts={factory.upgradeRecipe.input} />
					</>
				) : (
					`Error: Unknown factory type ${(factory as any).type}`
				)}
				<h4>Recipes</h4>
				{Array.from(factory.recipes.values())
					.sort(keyByString((r) => r.name))
					.map((recipe) => {
						const otherFactories = recipe.factories.filter((f) => f !== factory)
						return (
							<div key={recipe.id}>
								<Link to={`/recipes/${recipe.id}`}>
									<RecipeIcon recipe={recipe} /> {recipe.name}
								</Link>
								{otherFactories.length ? (
									<>
										{' '}
										(also in <FactoryListInline factories={otherFactories} />)
									</>
								) : null}
							</div>
						)
					})}
			</div>
		</div>
	)
}

function FactoriesPage() {
	const fmConfig = useContext(FMConfigContext)
	return (
		<div className="Page">
			<TopBar />
			<div className="Page-Content">
				<h3>Factories: {Object.keys(fmConfig.factories).length}</h3>
				{oValues(fmConfig.factories)
					.sort(keyByString((fac) => fac.name))
					.map((fac) => {
						const iconRecipe = getRepresentativeRecipeForFactory(fac)
						return (
							<div key={fac.name}>
								<Link to={mkFacPath(fac)}>
									<RecipeIcon recipe={iconRecipe} /> {fac.name} (
									{fac.recipes.size} recipes)
								</Link>
							</div>
						)
					})}
			</div>
		</div>
	)
}

const getRepresentativeRecipeForFactory = (fac: Factory) =>
	firstIt(fac.recipes.values())

const FactoryListInline = (props: { factories: Factory[] }) => (
	<>
		{props.factories.sort(keyByString((fac) => fac.name)).map((fac, i) => (
			<span key={fac.name}>
				{i !== 0 && ', '}
				<Link to={mkFacPath(fac)}>{fac.name}</Link>
			</span>
		))}
	</>
)

function RecipePage() {
	const { id = '' } = useParams()
	const fmConfig = useContext(FMConfigContext)

	const recipe = fmConfig.recipes[id]
	if (!recipe)
		return <div className="Page centerhv">Error: No such recipe: {id}</div>

	return (
		<div className="Page">
			<TopBar />
			<div className="Page-Content">
				<h3>{recipe.name}</h3>
				<p>
					Available in <FactoryListInline factories={recipe.factories} />
				</p>
				{'upgradesToFactory' in recipe && (
					<p>
						Upgrades to{' '}
						<Link to={mkFacPath(recipe.upgradesToFactory)}>
							{recipe.upgradesToFactory.name}
						</Link>
					</p>
				)}
				<p>
					Runs for {recipe.runSec} seconds, consuming{' '}
					{(recipe.runSec / recipe.fuelConsumeSec).toFixed(0)} fuel
				</p>
				{'health_gained' in recipe && (
					<p>Heals factory by {recipe.health_gained}</p>
				)}
				{'input' in recipe && (
					<>
						<h4>Inputs</h4>
						<ItemCountsTable itemCounts={recipe.input} />
					</>
				)}
				{'output' in recipe && (
					<>
						<h4>Outputs</h4>
						<ItemCountsTable itemCounts={recipe.output} />
					</>
				)}
			</div>
		</div>
	)
}

function RecipesPage() {
	const fmConfig = useContext(FMConfigContext)
	return (
		<div className="Page">
			<TopBar />
			<div className="Page-Content">
				<h3>Recipes: {Object.keys(fmConfig.recipes).length}</h3>
				{oValues(fmConfig.recipes)
					.sort(keyByString((r) => r.name))
					.map((recipe) => {
						return (
							<div key={recipe.id}>
								<Link to={`/recipes/${recipe.id}`}>
									<RecipeIcon recipe={recipe} /> {recipe.name}
								</Link>{' '}
								(<FactoryListInline factories={recipe.factories} />)
							</div>
						)
					})}
			</div>
		</div>
	)
}

function RecipeIcon({ recipe }: { recipe: Recipe }) {
	const fmConfig = useContext(FMConfigContext)
	const iconMaterial = getIconMaterialForRecipe(recipe, fmConfig)
	return <ItemIcon id={iconMaterial} />
}

const getIconMaterialForRecipe = (recipe: Recipe, fmConfig: FMConfig): string =>
	recipe.type === 'PRODUCTION'
		? fmConfig.getItemForId(firstIt(recipe.output.keys()))!.material
		: recipe.type === 'COMPACT' || recipe.type === 'DECOMPACT'
		? 'chest'
		: recipe.type === 'UPGRADE'
		? getIconMaterialForRecipe(
				getRepresentativeRecipeForFactory(recipe.upgradesToFactory),
				fmConfig
		  )
		: 'air'

function ItemPage() {
	const { material = '', customName } = useParams()
	const itemInfos = useItemInfos()
	const fmConfig = useContext(FMConfigContext)

	const items = oValues(fmConfig.recipeItems[material]!).filter(
		(item) => item.customName === customName
	)
	if (!items.length)
		return <div className="Page centerhv">Error: No such item: {material}</div>

	const matName = itemInfos?.[material]?.name
	const title = customName ? (
		<>
			{customName} ({matName} <ItemIcon id={material} />)
		</>
	) : (
		<>
			{matName} <ItemIcon id={material} />
		</>
	)

	const madeInRecipes = items
		.map((item) => item.madeInRecipes)
		.flat()
		.sort(keyByString((r) => r.name))

	const usedInRecipes = items
		.map((item) => item.usedInRecipes)
		.flat()
		.sort(keyByString((r) => r.name))

	const usedInFactoryCreations = items
		.map((item) => item.usedInFactoryCreations)
		.flat()
		.sort(keyByString((fac) => fac.name))

	return (
		<div className="Page">
			<TopBar />
			<div className="Page-Content">
				<h3>{title}</h3>
				<h4>Made in {madeInRecipes.length} Recipes</h4>
				{madeInRecipes.map((recipe) => (
					<div key={recipe.id}>
						<Link to={`/recipes/${recipe.id}`}>
							<RecipeIcon recipe={recipe} /> {recipe.name}
						</Link>{' '}
						(<FactoryListInline factories={recipe.factories} />)
					</div>
				))}
				<h4>Used in {usedInRecipes.length} Recipes</h4>
				{usedInRecipes.map((recipe) => (
					<div key={recipe.id}>
						<Link to={`/recipes/${recipe.id}`}>
							<RecipeIcon recipe={recipe} /> {recipe.name}
						</Link>{' '}
						(<FactoryListInline factories={recipe.factories} />)
					</div>
				))}
				<h4>Used in {usedInFactoryCreations.length} Factory set-ups</h4>
				{usedInFactoryCreations.map((fac) => (
					<div key={fac.name}>
						<Link to={mkFacPath(fac)}>
							<RecipeIcon recipe={getRepresentativeRecipeForFactory(fac)} />{' '}
							{fac.name}
						</Link>
					</div>
				))}
			</div>
		</div>
	)
}

function ItemsPage() {
	const fmConfig = useContext(FMConfigContext)
	const [itemSearch, setItemSearch] = useState('')
	const items = useMemo(() => {
		const items = oValues(fmConfig.recipeItems)
			.map((d) => oValues(d))
			.flat()
		if (!itemSearch.trim()) return items
		const words = itemSearch.toLowerCase().trim().split(/\s+/g)
		return items.filter((item) =>
			words.every((word) => item.id.toLowerCase().includes(word))
		)
	}, [itemSearch, fmConfig.recipeItems])
	return (
		<div className="Page">
			<TopBar />
			<div className="Page-Content">
				<label>
					{'Find item: '}
					<input
						type="search"
						value={itemSearch}
						onChange={(e) => setItemSearch(e.target.value)}
					/>
				</label>
				<h3>
					{itemSearch ? 'Matching ' : ''}Items: {items.length}
				</h3>
				<p>
					These items are created/consumed in factory recipes; other Vanilla
					items are not listed.
				</p>
				{items.sort(keyByString((item) => item.id)).map((item) => (
					<div key={item.id}>
						<ItemLink item={item} />
					</div>
				))}
			</div>
		</div>
	)
}

function ItemLink(props: { item: Item }) {
	const itemInfos = useItemInfos()
	const { item } = props
	const name = itemInfos?.[item.material]?.name || item.material
	const linkPath = item.customName
		? `/items/${item.material}/${item.customName}`
		: `/items/${item.material}`
	return (
		<Link to={linkPath}>
			<ItemIcon id={item.material} />{' '}
			{item.customName ? `"${item.customName}" (${name})` : name}{' '}
			{item.lore ? (
				<span style={{ color: 'purple' }}>{item.lore.join(' / ')}</span>
			) : null}
		</Link>
	)
}

function ItemCountsTable({ itemCounts }: { itemCounts: ItemCounts }) {
	const fmConfig = useContext(FMConfigContext)
	return (
		<table style={{ border: 0 }}>
			{Array.from(itemCounts.entries()).map(([itemId, count]) => {
				const item = fmConfig.getItemForId(itemId)!
				return (
					<tr>
						<td align="right">{count}</td>
						<td>
							<ItemLink item={item} />
						</td>
					</tr>
				)
			})}
		</table>
	)
}

function firstIt<T>(x: Iterator<T>): T {
	const next = x.next()
	if (next.done) throw new Error('Empty iterator')
	return next.value
}

function keyByString<T>(fn: (e: T) => string) {
	return (a: T, b: T) => fn(a).localeCompare(fn(b))
}

/** hack around type system */
function oValues<T>(o: NodeJS.Dict<T>) {
	return Object.values(o) as T[]
}
