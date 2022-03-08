import useSWRImmutable from 'swr/immutable'
import './ItemIcon.css'

export function ItemIcon({ id }: { id: string }) {
	const itemInfo = useItemInfos()?.[id]

	const style = itemInfo?.offset
		? mkOffsetIconStyle(itemInfo.offset)
		: itemInfo
		? mkImgIconStyle(id)
		: undefined

	return <span className="ItemIcon" style={style} />
}

const mkImgIconStyle = (id: string): React.CSSProperties => ({
	backgroundImage: `url("//mc-icons.netlify.app/icons/${id}.png")`,
	backgroundSize: 'contain',
})

const mkOffsetIconStyle = (offset: string): React.CSSProperties => ({
	backgroundImage: 'url("//mc-icons.netlify.app/items_atlas.png")',
	backgroundPosition: offset,
})

export function useItemInfos() {
	const { data: itemInfos } = useSWRImmutable<ItemInfos>(
		'//mc-icons.netlify.app/item_infos.json',
		fetchJsonLogErrors
	)
	return itemInfos
}

const fetchJsonLogErrors = (url: string) =>
	fetch(url)
		.then((r) => r.json())
		.catch((err) => {
			console.error(err)
			throw err
		})

export type ItemInfos = {
	[id: string]: { name: string } & (
		| { img: string; offset?: undefined }
		| { img?: undefined; offset: string }
	)
}
