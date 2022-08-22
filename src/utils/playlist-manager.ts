import { ytMetadata, ytRetrievePlaylist, ytSearch, ytSuggestions } from './youtube'
import Song from './song'
import { isValidHttpUrl, sleep } from './common'
import { Res, err, s, d } from './res'

export default class PlaylistManager {

	private isAutoplay: boolean
	private status: 'playing' | 'idle' | 'paused' | 'stopped' = 'stopped'
	private cache: Song
	private npIdCache: string
	private attempt: number

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

		const song = (!!this.activeSong ? this.activeSong : this.cache)
		if (!song) {
			return false
		}

		const suggested = await ytSuggestions(song)
		console.log('suggested', suggested)
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
		} catch (e) {
			console.error(e)
			return err('Playlist is empty!')
		}
	}

	public nowPlaying(): Res {
		const np = this.activeSong
		return np ? d(np) : err('Empty list.')
	}

	public async add(query: string, username: string, id: string, avatar: string, nowPlayingId: string): Promise<Res> {
		try {
			if (!query || query === '') {
				return err('Cannot add the song. Please provide keywords or Youtube URL!')
			}

			let q
			if (isValidHttpUrl(query)) {
				q = await ytMetadata(query)
				if (!q) {
					return err('Only youtube video link is supported currently. Youtube music and spotify link is coming soon!')
				}
			} else {
				q = await ytSearch(query)
			}

			if (!q) {
				throw 0
			}

			console.log('Adding', q)
			q.requestBy = {
				name: username,
				avatar: `https://cdn.discordapp.com/avatars/${ id }/${ avatar }`,
				userId: id,
			}

			this.queues.push(q)
			const list = this.getUsedList()
			const n = list.length - (!!list && list.length > 1 && list[ 0 ].youtubeId === nowPlayingId ? 1 : 0)
			const msg = n <= 1 ? '`Up next.`' : '`' + (n - 1) + ' song' + (n > 2 ? 's' : '') + ' away.`'
			this.autoplay = []
			return s(msg, q)

		} catch (e) {
			console.error(e)
			return err('Cannot add the song. Please try again with another keywords!')
		}
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
		const arr = [...this.queues, ...this.playlist, ...this.autoplay]
		if (arr.length > 0 && arr[ 0 ].youtubeId === nowPlayingId) {
			arr.splice(0, 1)
		}

		return d(arr)
	}

	public async setPlaylist(link: string): Promise<Res> {
		try {

			const parsedURL = new URL(link)
			const params = parsedURL.searchParams
			const listId = params.get('list')
			if (!!listId) {
				this.playlist.splice(0, this.playlist.length)
				const isRetrieved = await ytRetrievePlaylist(listId, this.playlist)
				if (!isRetrieved) {
					throw 0
				}

				console.log(this.playlist)
				return s('Playlist has been loaded.')
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
