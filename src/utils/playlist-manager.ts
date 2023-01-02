import { ytMetadata, ytRetrieve, ytRetrievePlaylist, ytSearch, ytSelect, ytSuggestions } from './youtube'
import Song from './song'
import { isValidHttpUrl, sleep } from './common'
import { Res, err, s, d } from './res'
import * as url from 'url'
import { searchMusics } from 'node-youtube-music'

export default class PlaylistManager {

	private isAutoplay: boolean
	private status: 'playing' | 'idle' | 'paused' | 'stopped' = 'stopped'
	private cache: Song
	private npIdCache: string
	private attempt: number
	public isAllAdmin: boolean

	private maxLength = 800 // seconds
	private queues: Array<Song> = []
	private autoplay: Array<Song> = []
	private playlist: Array<Song> = []

	constructor() {
	}

	private getUsedList(): Array<Song> {

		const npId = this.npIdCache
		const hasQueues = !!this.queues && this.queues.length > 1
		const hasUnplayedQueues = !!this.queues && this.queues.length > 0 && npId !== this.queues[ 0 ].youtubeId

		const hasPlaylist = !!this.playlist && this.playlist.length > 1
		const hasUnplayedPlaylist = !!this.playlist && this.playlist.length > 0 && npId !== this.playlist[ 0 ].youtubeId

		if (hasQueues || hasUnplayedQueues) {
			return this.queues
		}

		if (hasPlaylist || hasUnplayedPlaylist) {
			return this.playlist
		}

		return this.autoplay
	}

	private get activeSong(): Song {

		const l = this.getUsedList()
		const song = !!l && l.length > 0 ? l[ 0 ] : null
		if (!!song) {
			this.cache = song
		}

		return song
	}

	private async getSuggestion(isSleep?: boolean) {
		if (isSleep) {
			await sleep(2000)
		}

		const song = (!!this.queues && this.queues.length > 0 ? this.queues[ this.queues.length - 1 ] : !!this.activeSong ? this.activeSong : this.cache)
		if (!song) {
			return false
		}

		const suggested = await ytSuggestions(song)
		if (!!suggested && suggested.length > 0) {
			this.autoplay = suggested
		}
		return true
	}

	private async refreshAutoplay() {
		const hasQueues = !!this.queues && this.queues.length > 1
		const hasPlaylist = !!this.playlist && this.playlist.length > 1
		const isEmptyAutoplay = this.isAutoplay && this.autoplay.length <= 1
		if (isEmptyAutoplay && (!hasPlaylist || !hasQueues)) {
			await this.getSuggestion()
		}
	}

	public delete(youtubeId: string): Res {
		for (let l of [this.queues, this.playlist, this.autoplay]) {
			for (let i = 0; i < l.length; i++) {
				const song = l[ i ]
				if (song.youtubeId === youtubeId) {
					l.splice(i, 1)
					break
				}
			}
		}

		return s()
	}

	public async nextSong(npId: string) {
		try {
			if (npId === this.npIdCache) {
				this.attempt++
				if (this.attempt > 50) {
					this.delete(npId)
					this.attempt = 0
				}
			}

			this.npIdCache = npId
			await this.refreshAutoplay()
			const hasQueues = !!this.queues && this.queues.length > 1
			const hasUnplayedQueues = !!this.queues && this.queues.length > 0 && npId !== this.queues[ 0 ].youtubeId
			if (hasQueues || hasUnplayedQueues) {
				return d(this.queues[ npId === this.queues[ 0 ].youtubeId ? 1 : 0 ])
			}

			const hasPlaylist = !!this.playlist && this.playlist.length > 1
			const hasUnplayedPlaylist = !!this.playlist && this.playlist.length > 0 && npId !== this.playlist[ 0 ].youtubeId
			if (hasPlaylist || hasUnplayedPlaylist) {
				return d(this.playlist[ hasUnplayedPlaylist ? 0 : 1 ])
			}

			const hasAutoplay = !!this.autoplay && this.autoplay.length > 1
			const hasUnplayedAutoplay = !!this.autoplay && this.autoplay.length > 0 && npId !== this.autoplay[ 0 ].youtubeId
			if (hasAutoplay || hasUnplayedAutoplay) {
				return d(this.autoplay[ hasUnplayedAutoplay ? 0 : 1 ])
			}

			throw 'empty!'
		} catch (e) {
			console.error(e)
			return err('Playlist is empty!')
		}
	}

	public nowPlaying(): Res {
		const np = this.activeSong
		return np ? d(np) : err('Empty list.')
	}

	public async search(query: string): Promise<Res> {
		if (!query || query === '') {
			return err('Cannot find the song. Please provide the keywords!')
		}

		let rs2 = null
		if (isValidHttpUrl(query)) {

			let val = undefined
			if (query.includes('youtu.be')) {
				const urlParts = query.split('/')
				val = urlParts[ urlParts.length - 1 ]
			} else {
				const urlParts = url.parse(query, true)
				val = String(urlParts.query.v)
			}

			if (!val || val === 'undefined') {
				return err('The link you provided is not supported!')
			}

			rs2 = await ytRetrieve(val)
			if (rs2.length > 0) {
				query = rs2[ 0 ].title
			} else {
				return err('The link you provided is not supported!')
			}

		}

		try {
			const rs = await searchMusics(query)
			const songs = []
			let i = 0
			for (const s of rs) {
				i++
				const song = new Song(s)
				song.isYtMusic = true
				songs.push(song)
				if (i >= 5) {
					break
				}
			}

			if (!rs2) {
				rs2 = await ytSearch(query)
			}

			for (const s2 of rs2) {
				songs.push(s2)
			}

			return s('', songs)
		} catch (e) {
			console.error(e.response.data.error)
			return err('Cannot find the song. Please provide the keywords!')
		}
	}

	public async add(query: string, username: string, id: string, avatar: string, nowPlayingId: string, selectedSong: Song): Promise<Res> {
		try {
			if ((!query || query === '') && !selectedSong) {
				return err('Cannot add the song. Please provide keywords or Youtube URL!')
			}

			let q
			if (!!selectedSong) {
				q = selectedSong
			} else if (isValidHttpUrl(query)) {

				const url_parts = url.parse(query, true)
				const val = String(url_parts.query.v)

				if (!val || val === 'undefined') {
					return err('The link you provided is not supported!')
				}

				q = await ytSelect(val)

				if (!q) {
					q = await ytMetadata(query)
					if (!q) {
						return err('Only youtube / youtube music link is supported currently. Spotify link is coming soon!')
					}
				}
			} else {
				q = await ytSelect(query)
			}

			if (!q) {
				throw 0
			}

			console.log('Adding', q)
			q.requestBy = {
				name: username,
				avatar: `https://cdn.discordapp.com/avatars/${ id }/${ avatar }`,
				userId: Number(id),
			}

			let info = 'Added a song to the playlist.'
			const inARow = this.checkSameUserInARow(q.requestBy.userId)
			const isInARow = !!inARow
			if (isInARow) {
				this.queues.splice(inARow.index, 0, q)
				info = 'The song was successfully added before the other songs because someone added more than one song.'
			} else {
				this.queues.push(q)
			}

			const list = this.getUsedList()
			const n = list.length - (!!list && list.length > 1 && list[ 0 ].youtubeId === nowPlayingId ? 1 : 0)
			const nInARow = isInARow ? inARow.index - (!!list && list.length > 1 && list[ 0 ].youtubeId === nowPlayingId ? 1 : 0) : 0
			const far = (isInARow ? (nInARow) : n - 1)
			const msg = far < 1 ? '`Up next.`' : '`' + far + ' song' + (far > 2 ? 's' : '') + ' away.`'
			this.autoplay.splice(0, this.autoplay.length)
			this.autoplay = []
			return s(msg, { ...q, info })

		} catch (e) {
			console.error(e)
			return err('Cannot add the song. Please try again with another keywords!')
		}
	}

	checkSameUserInARow(userId: number): { index: number, userId: number } {
		try {
			let lastIndex = -1
			// Find on the array if the ID already registered and use it as starting point.
			for (let i = this.queues.length - 1; i >= 0; i--) {
				if (Number(userId) === Number(this.queues[ i ].requestBy.userId)) {
					lastIndex = i
					break
				}
			}

			// Find the duplicated ID. If found, return it.
			for (let i = lastIndex + 1; i < this.queues.length; i++) {
				const q1 = Number(this.queues[ i ].requestBy.userId)
				for (let j = i + 1; j < this.queues.length; j++) {
					const q2 = Number(this.queues[ j ].requestBy.userId)
					if (q1 === q2) {
						// Found duplicated ID!
						return { index: j, userId: q2 }
					}
				}
			}
		} catch (e) {
			console.error(e)
		}

		return
	}

	async setAutoplay(state: 'on' | 'off'): Promise<Res> {
		this.isAutoplay = state === 'on'
		console.log('Autoplay', state)
		if (this.isAutoplay) {
			if (!this.activeSong || !this.activeSong.youtubeId || this.activeSong.youtubeId === '') {
				return s('In order to activate Autoplay, please add at least 1 song as recommendation')
			}

			return s('Autoplay turned on.')
		} else {
			return s('Autoplay turned off.')
		}
	}

	getAutoplayState(): Res {
		return d({ state: this.isAutoplay })
	}

	setMaxlength(length: number): Res {
		this.maxLength = length
		return s(`Maximum duration set to ${ length } seconds`)
	}

	setStatus(status: 'playing' | 'idle' | 'paused' | 'stopped' = 'stopped'): Res {
		this.status = status
		return s()
	}

	getMaxlength(): Res {
		return d({ length: this.maxLength })
	}

	public showUpcoming(nowPlayingId: string): Res {
		const arr = [...this.queues, ...this.playlist]
		if (arr.length > 0 && arr[ 0 ].youtubeId === nowPlayingId) {
			arr.splice(0, 1)
		}

		return d(arr)
	}

	public setAdmin(status: string) {
		this.isAllAdmin = !!status
		return s()
	}

	public async setPlaylist(link: string, shuffle: string): Promise<Res> {
		try {
			const isShuffle = shuffle === 'on'
			const parsedURL = new URL(link)
			const params = parsedURL.searchParams
			const listId = params.get('list')
			if (!!listId) {
				this.playlist.splice(0, this.playlist.length)
				const songs = await ytRetrievePlaylist(listId, isShuffle)
				if (songs.length <= 0) {
					throw 0
				}

				this.playlist = songs
				console.log(this.playlist)
				return s('Playlist has been loaded. Please note, added song will be prioritized.')
			} else {
				return err('Please provide a correct Youtube playlist link.')
			}
		} catch (e) {
			console.error(e)
			return err('There is a problems with your link provided or network connection problems encountered.')
		}
	}

	public getStatus(): Res {
		return d({ status: this.status })
	}

	public removeFromPlaylist(index: number): Res {
		try {
			const list = this.getUsedList()
			const i = index - 1
			if (i > list.length - 1 || i < 0 || list.length === 0) {
				return err('Your index is incorrect. You can find the index using command `/u` in the very left of the list.')
			}

			const song = list[ i ]
			list.splice(i, 1)
			return s(song.title + ' removed from playlist.')
		} catch (e) {
			return err('Cannot remove the song from playlist!')
		}
	}

	public clearPlaylist(): Res {
		this.queues = []
		this.autoplay = []
		this.playlist = []
		console.log(this.queues, this.autoplay, this.playlist)
		return s()
	}

	public getData(): Res {
		return d({
			isAutoplay: this.isAutoplay,
			status: this.status,
			maxLength: this.maxLength,
			nowPlaying: this.activeSong || null,
		})
	}

}
