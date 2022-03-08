import { useState } from 'react'
import useSWRImmutable from 'swr/immutable'
import { FMConfig, oValues } from './FMConfig'
import { ItemIcon, useItemInfos } from './ItemIcon'

const configUrlCivClassic =
	'https://raw.githubusercontent.com/CivClassic/AnsibleSetup/master/templates/public/plugins/FactoryMod/config.yml.j2'

export function App() {
	const [configUrl, setConfigUrl] = useState(configUrlCivClassic)
	const itemInfos = useItemInfos()

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
			<label>
				{'Config URL: '}
				<input
					type="text"
					value={configUrl}
					onChange={(e) => setConfigUrl(e.target.value)}
				/>
				{isLoading && ' Loading ...'}
			</label>
			{fmConfig ? (
				<>
					<h3>Items: {Object.keys(fmConfig.items).length}</h3>
					{oValues(fmConfig.items).map((item) => (
						<div key={item.id}>
							<ItemIcon id={item.material} />
							{itemInfos?.[item.id]?.name || item.id}
						</div>
					))}
					<h3>Factories: {Object.keys(fmConfig.factories).length}</h3>
					{oValues(fmConfig.factories).map((fac) => (
						<pre key={fac.name}>{fac.name}</pre>
					))}
					<h3>Recipes: {Object.keys(fmConfig.recipes).length}</h3>
					{oValues(fmConfig.recipes).map((rec) => (
						<pre key={rec.id}>
							{rec.name} ({rec.factories.map((fac) => fac.name).join(', ')})
						</pre>
					))}
				</>
			) : error ? (
				<pre>{String(error)}</pre>
			) : (
				<pre>Loading config ...</pre>
			)}
		</div>
	)
}
