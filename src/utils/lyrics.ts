const lyricsFinder = require('lyrics-finder')

export async function findLyrics(title: string, artist?: string): Promise<string | null> {

	try {
		const lyrics = await lyricsFinder(artist, title)
		return lyrics || null
	} catch (e) {
		console.error(e)
	}

	return null
}
