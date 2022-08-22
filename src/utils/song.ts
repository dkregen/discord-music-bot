import { AudioResource, createAudioResource } from '@discordjs/voice'
import play = require('play-dl')

export default class Song {

	isYtMusic: boolean
	audioResource: AudioResource
	youtubeId: string
	title: string = ''
	artists: Array<{ name: string, id: string }> = []
	isExplicit: boolean
	album: string
	thumbnailUrl: string
	duration: { label: string, totalSeconds: number } = { label: '', totalSeconds: 0 }
	requestBy: { id: number, name: string, avatar: string }
	colors: Array<any> = []

	constructor(r?: any) {
		if (!!r) {
			this.youtubeId = r.youtubeId || ''
			this.title = r.title || ''
			this.artists = r.artists || []
			this.isExplicit = r.isExplicit || false
			this.album = r.album || ''
			this.thumbnailUrl = r.thumbnailUrl || ''
			this.duration = r.duration || this.duration
			this.colors = r.colors || []
			this.requestBy = r.requestBy || undefined
		}
	}

	isEmpty() {
		return !this.youtubeId || this.youtubeId === ''
	}

	public async generateAudioResource(): Promise<Boolean> {
		try {
			const url = `https://www.youtube.com/watch?v=${ this.youtubeId }`
			let stream = await play.stream(url, { discordPlayerCompatibility: true })
			this.audioResource = createAudioResource(stream.stream, {
				inputType: stream.type,
			})
			return true
		} catch (e) {
			console.error(e)
			return false
		}
	}

	static toArray(arr: Array<any>) {
		const res: Array<Song> = []
		arr.forEach(a => {
			const s = new Song(a)
			if (!s.isEmpty()) {
				res.push(s)
			}
		})

		return res
	}

}
