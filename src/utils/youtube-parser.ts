import got from 'got'
import axios from 'axios'

export class ParserService {

	parseVideo(data: any) {
		if (!data) return undefined

		try {
			let title = ''
			if (data.videoRenderer){
				title = data.videoRenderer.title.runs[0].text
				title = title.replace("\\\\", "\\")

				try {
					title = decodeURIComponent(title)
				} catch (e) {
					console.error(e)
				}

				return {
					id: {
						videoId: data.videoRenderer.videoId
					},
					url: `https://www.youtube.com/watch?v=${data.videoRenderer.videoId}`,
					title,
					description: data.videoRenderer.descriptionSnippet && data.videoRenderer.descriptionSnippet.runs[0] ? data.videoRenderer.descriptionSnippet.runs[0].text : "",
					duration_raw: data.videoRenderer.lengthText ? data.videoRenderer.lengthText.simpleText : null,
					snippet: {
						url: `https://www.youtube.com/watch?v=${data.videoRenderer.videoId}`,
						duration: data.videoRenderer.lengthText ? data.videoRenderer.lengthText.simpleText : null,
						publishedAt: data.videoRenderer.publishedTimeText ? data.videoRenderer.publishedTimeText.simpleText : null,
						thumbnails: {
							id: data.videoRenderer.videoId,
							url: data.videoRenderer.thumbnail.thumbnails[data.videoRenderer.thumbnail.thumbnails.length - 1].url,
							default: data.videoRenderer.thumbnail.thumbnails[data.videoRenderer.thumbnail.thumbnails.length - 1],
							high: data.videoRenderer.thumbnail.thumbnails[data.videoRenderer.thumbnail.thumbnails.length - 1],
							height: data.videoRenderer.thumbnail.thumbnails[data.videoRenderer.thumbnail.thumbnails.length - 1].height,
							width: data.videoRenderer.thumbnail.thumbnails[data.videoRenderer.thumbnail.thumbnails.length - 1].width
						},
						title,
						views: data.videoRenderer.viewCountText && data.videoRenderer.viewCountText.simpleText ? data.videoRenderer.viewCountText.simpleText.replace(/[^0-9]/g, "") : 0
					},
					views: data.videoRenderer.viewCountText && data.videoRenderer.viewCountText.simpleText ? data.videoRenderer.viewCountText.simpleText.replace(/[^0-9]/g, "") : 0
				}

			} else if (data.videoWithContextRenderer){
				if (data.videoWithContextRenderer.headline?.runs && data.videoWithContextRenderer.headline?.runs.length > 0){
					title = data.videoWithContextRenderer.headline?.runs[0].text
				}else{
					title = data.videoWithContextRenderer.headline?.accessibility?.accessibilityData?.label
				}

				title = title.replace("\\\\", "\\")

				try {
					title = decodeURIComponent(title)
				} catch (e) {
					// @ts-ignore
				}

				return {
					id: {
						videoId: data.videoWithContextRenderer.videoId
					},
					url: `https://www.youtube.com/watch?v=${data.videoWithContextRenderer.videoId}`,
					title,
					description: '',
					duration_raw: data.videoWithContextRenderer.lengthText?.accessibility?.accessibilityData?.text,
					snippet: {
						url: `https://www.youtube.com/watch?v=${data.videoWithContextRenderer.videoId}`,
						duration: data.videoWithContextRenderer.lengthText?.accessibility?.accessibilityData?.text,
						publishedAt: data.videoWithContextRenderer.publishedTimeText?.runs?.length > 0 ? data.videoWithContextRenderer.publishedTimeText?.runs[0].text : null,
						thumbnails: {
							id: data.videoWithContextRenderer.videoId,
							url: data.videoWithContextRenderer.thumbnail.thumbnails[data.videoWithContextRenderer.thumbnail.thumbnails.length - 1].url,
							default: data.videoWithContextRenderer.thumbnail.thumbnails[data.videoWithContextRenderer.thumbnail.thumbnails.length - 1],
							high: data.videoWithContextRenderer.thumbnail.thumbnails[data.videoWithContextRenderer.thumbnail.thumbnails.length - 1],
							height: data.videoWithContextRenderer.thumbnail.thumbnails[data.videoWithContextRenderer.thumbnail.thumbnails.length - 1].height,
							width: data.videoWithContextRenderer.thumbnail.thumbnails[data.videoWithContextRenderer.thumbnail.thumbnails.length - 1].width
						},
						title,
						views: data.videoWithContextRenderer.shortViewCountText?.accessibility?.accessibilityData?.label?.replace(/[^0-9]/g, "")
					},
					views: data.videoWithContextRenderer.shortViewCountText?.accessibility?.accessibilityData?.label?.replace(/[^0-9]/g, "")
				}
			}

			return undefined
		} catch (e) {
			return undefined
		}
	}
}




export async function searchVideo(searchQuery: string) {
	const YOUTUBE_URL = 'https://www.youtube.com'

	const results = []
	let details = []
	let fetched = false
	const options = { type: "video", limit: 0 }

	const searchRes: any = await axios.get(`${YOUTUBE_URL}/results?q=${searchQuery.trim()}&hl=en`)
	let html = searchRes.data
	// try to parse html
	try {
		const data = html.split("ytInitialData = ")[1].split("</script>")[0]
		html = data.replace(/\\x([0-9A-F]{2})/ig, (...items) => {
			return String.fromCharCode(parseInt(items[1], 16))
		})
		html = html.replaceAll("\\\\\"", "")
		html = JSON.parse(html)
	} catch(e) { /* nothing */}

	if(html && html.contents && html.contents.sectionListRenderer && html.contents.sectionListRenderer.contents
		&& html.contents.sectionListRenderer.contents.length > 0 && html.contents.sectionListRenderer.contents[0].itemSectionRenderer &&
		html.contents.sectionListRenderer.contents[0].itemSectionRenderer.contents.length > 0){
		details = html.contents.sectionListRenderer.contents[0].itemSectionRenderer.contents
		fetched = true
	}
	// backup/ alternative parsing
	if (!fetched) {
		try {
			details = JSON.parse(html.split('{"itemSectionRenderer":{"contents":')[html.split('{"itemSectionRenderer":{"contents":').length - 1].split(',"continuations":[{')[0])
			fetched = true
		} catch (e) {
			console.error(e)
		}
	}
	if (!fetched) {
		try {
			details = JSON.parse(html.split('{"itemSectionRenderer":')[html.split('{"itemSectionRenderer":').length - 1].split('},{"continuationItemRenderer":{')[0]).contents
			fetched = true
		} catch(e) { console.error(e) }
	}

	if (!fetched) return []

	for (let i = 0; i < details.length; i++) {
		if (typeof options.limit === "number" && options.limit > 0 && results.length >= options.limit) break
		const data = details[i]

		const parserService = new ParserService()
		const parsed = parserService.parseVideo(data)
		if (!parsed) continue
		const res = parsed

		results.push(res)
	}

	return results
}
