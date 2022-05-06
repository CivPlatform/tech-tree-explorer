import { useEffect, useState } from 'react'
import './ItemIcon.css'

/** `id` is material */
export function ItemIcon({ id }: { id: string }) {
	const itemInfo = useItemInfos()?.[id]

	const style = itemInfo?.offset
		? mkOffsetIconStyle(itemInfo.offset)
		: itemInfo
		? mkImgIconStyle(id)
		: undefined

	return <span className="ItemIcon" style={style} />
}

const iconsApiRoot = '//mc-icons.netlify.app'

const mkImgIconStyle = (id: string): React.CSSProperties => ({
	backgroundImage: `url("${iconsApiRoot}/icons/${id}.png")`,
	backgroundSize: 'contain',
})

const mkOffsetIconStyle = (offset: string): React.CSSProperties => ({
	backgroundImage: `url("${iconsApiRoot}/items_atlas.png")`,
	backgroundPosition: offset,
	imageRendering: 'pixelated',
})

export type ItemInfos = {
	[id: string]: { name: string; offset?: string }
}

export function useItemInfos() {
	const [itemInfos, setItemInfos] = useState<ItemInfos | undefined>(undefined)
	useEffect(() => {
		itemInfosP.then(setItemInfos)
	}, [])
	return itemInfos
}

export const itemInfosP: Promise<ItemInfos> = fetchJsonLogErrors(
	`${iconsApiRoot}/item_infos.json`
)

function fetchJsonLogErrors(url: string) {
	return fetch(url)
		.then((r) => r.json())
		.catch((err) => {
			console.error(err)
			throw err
		})
}
