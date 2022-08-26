import { Client, EmbedBuilder } from 'discord.js'
import {
	AudioPlayer, AudioPlayerStatus,
	createAudioPlayer,
	joinVoiceChannel,
	VoiceConnection, VoiceConnectionStatus,
} from '@discordjs/voice'
import { embedAddedSong, embedNowPlaying, embedPlaylist, request, sleep } from './common'
import Song from './song'

const MESSAGE_CHANNEL_ID = process.env.GROUP_MESSAGE_CHANNEL_ID || ''

export class Player {

	private maxlength: number
	private timestamp: number
	private upcoming: Song
	private nowPlaying: Song
	private cache: Song
	private connection: VoiceConnection
	private readonly PLAYER: AudioPlayer
	private status: 'playing' | 'paused' | 'stopped' = 'stopped'
	private isConnected: boolean
	private attempt: number
	private playlist: Array<Song>

	constructor(
		private channel: any,
		private client: Client,
	) {
		this.PLAYER = createAudioPlayer()
		this.PLAYER.on('stateChange', async (oldOne, newOne) => {
			if (!!newOne.status && newOne.status === AudioPlayerStatus.Idle && this.status === 'playing') {
				await this.next()
			}
		})

		this.init().then()
	}

	private join() {
		if (!this.isConnected) {
			const connection = joinVoiceChannel({
				channelId: this.channel.id,
				guildId: this.channel.guild.id,
				adapterCreator: this.channel.guild.voiceAdapterCreator,
			})

			connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
				try {
					if (newState.status === 'disconnected') {
						connection.destroy()
						this.isConnected = false
					}
				} catch (error) {
					this.isConnected = false
					connection.destroy()
				}
			})

			this.connection = connection
			this.connection.subscribe(this.PLAYER)
			this.isConnected = true
		}
	}

	private async init() {
		const r = await request(`/data`)
		if (r.isOk()) {

			await this.restoreNowPlaying()
			if (r.data.status === 'playing') {
				await this.play()
			}
		}
	}

	private async genUpcoming(isSleep?: boolean, currentYoutubeId?: string) {
		if (isSleep) {
			await sleep(10000)
		}

		if (currentYoutubeId && !!this.nowPlaying && this.nowPlaying.youtubeId !== currentYoutubeId) {
			return
		}

		const r = await request('/up-next', { youtubeId: this.nowPlaying ? this.nowPlaying.youtubeId : '' })
		if (r.isOk() && r.data) {
			const song = new Song(r.data)
			const isSame = !!this.upcoming && (!this.upcoming.audioResource || song.youtubeId !== this.upcoming.youtubeId)
			this.upcoming = song
			if (!isSame) {
				const isGenerated = await this.upcoming.generateAudioResource()
				if (!isGenerated) {
					await this.removeByYtId(this.upcoming.youtubeId)
					this.upcoming = undefined
					return await this.genUpcoming(false, currentYoutubeId)
				}
			}

			return true
		}

		return false
	}

	private async restoreNowPlaying() {

		const r = await request('/np')
		if (r.isOk() && r.data) {
			this.nowPlaying = new Song(r.data)
			const isGenerated = await this.nowPlaying.generateAudioResource()
			if (!isGenerated) {
				await this.removeByYtId(this.nowPlaying.youtubeId)
				this.nowPlaying = undefined
				this.restoreNowPlaying().then()
			}
			return true
		}

		return false
	}

	private async removeByYtId(youtubeId: string) {
		const r = await request('/delete', { youtubeId })
		if (r.isOk() && (!this.upcoming || youtubeId === this.upcoming.youtubeId)) {
			this.upcoming = undefined
			await this.genUpcoming(false, this.nowPlaying ? this.nowPlaying.youtubeId : undefined)
		}
		console.log(r)
	}

	private async startDurationWatcher(ytId: string) {
		try {
			while (true) {
				await sleep(60000)

				if (!this.nowPlaying || ytId === this.nowPlaying.youtubeId || !this.timestamp) {
					return
				}

				const r = await request('/get-maxlength')
				const len = r.data.length
				if (len) {
					this.maxlength = Number(len)
				}

				const now = (new Date()).getTime()
				if (now > this.timestamp + (this.maxlength * 1000)) {
					await this.sendMsg('Song duration reached maximum allowed stream time, song automatically skipped!')
					await this.next(undefined, true)
				}
			}
		} catch (e) {
			console.error('maxDurationWatcher', e)
		}
	}

	public async play(interaction?: any, isSkip?: boolean) {
		try {

			const isPlaying = this.status === 'playing' && this.nowPlaying
			if (isPlaying) {
				await this.sendMsg('Already playing!', interaction)
				return
			}

			let hasUpcoming = !!this.upcoming
			const hasRestored = (this.status === 'stopped' && !!this.nowPlaying)
			if (!hasUpcoming && !hasRestored) {
				await this.restoreNowPlaying()
				await this.genUpcoming()
			}

			hasUpcoming = !!this.upcoming
			if (!hasRestored && !hasUpcoming) {
				console.log('Job finished')
				this.status = 'stopped'
				await request('/set-status', { status: this.status })
				await this.sendMsg('Song not loaded! Please add a song using command `/a your keyword or video link`')
				this.timestamp = (new Date()).getTime()
				return
			}

			if (!this.nowPlaying) {
				await this.sendMsg('Error, the song not loaded!')
				return
			}

			this.join()
			this.nowPlaying = hasRestored ? this.nowPlaying : this.upcoming
			console.log('NOW PLAYING', this.nowPlaying)
			this.PLAYER.play(this.nowPlaying.audioResource)
			this.upcoming = null
			this.attempt = 0
			this.timestamp = (new Date()).getTime()
			this.startDurationWatcher(this.nowPlaying.youtubeId).then()

			let msg1
			let msg2
			if (isSkip) {
				msg1 = `Skipped, ${ this.cache ? this.cache.title : 'a song' }. Next!`
				msg2 = `Now Playing, **${ this.nowPlaying.title }** ${ this.nowPlaying.requestBy ? 'requested by ' + this.nowPlaying.requestBy.name : '' }`
			} else {
				msg1 = 'Connection with Youtube successfully restored.'
				msg2 = `Now Playing, **${ this.nowPlaying.title }** ${ this.nowPlaying.requestBy ? 'requested by ' + this.nowPlaying.requestBy.name : '' }`
			}

			this.cache = this.nowPlaying
			await this.sendEmbedMsg(new EmbedBuilder().setDescription(msg2), msg1, interaction)
			this.status = 'playing'
			await request('/set-status', { status: this.status })
			await this.genUpcoming(true, this.nowPlaying.youtubeId)

		} catch (e) {
			console.error(e)
			await this.sendMsg(`Cannot play the song, ${ this.attempt < 6 ? 'retrying . . .' : 'gave up!' }`, interaction)
			await this.stop(interaction)
			if (this.attempt < 6) {
				await this.play(interaction)
				this.attempt++
			} else {
				await sleep(1000)
				await this.next(interaction, isSkip)
			}
		}
	}

	public async stop(interaction: any) {
		try {
			this.PLAYER.stop()
			this.status = 'stopped'
			await this.nowPlaying.generateAudioResource()
			await this.sendMsg('Music stopped!', interaction)
			await request('/set-status', { status: this.status })
			this.timestamp = (new Date()).getTime()
		} catch (e) {
			console.error(e)
			await this.sendMsg('Cannot stop the song, please try again!', interaction)
		}
	}

	public async next(interaction?: any, isSkip?: boolean) {
		try {
			this.PLAYER.stop()
			this.status = 'paused'
			const youtubeId = this.nowPlaying.youtubeId
			if (isSkip) {
				await this.sendMsg(`Skipped ${ this.nowPlaying.title }.`, interaction)
			}
			this.play(interaction, isSkip).then()
			if (!!youtubeId) {
				await this.removeByYtId(youtubeId)
			}
		} catch (e) {
			console.error(e)
			await this.sendMsg('Cannot play next song, please try again!', interaction)
		}
	}

	public async add(interaction: any) {
		try {
			const query = interaction.options.getString('music')
			if (!query || query === '') {
				await this.sendMsg('Cannot add the song. Please provide keywords or Youtube URL!', interaction)
				return
			}

			const username = interaction.user.username
			const id = interaction.user.id
			const avatar = interaction.user.avatar
			const nowPlayingId = this.nowPlaying ? this.nowPlaying.youtubeId : ''
			const r = await request('/add', { query, username, id, avatar, nowPlayingId })
			if (r.status === 'error') {
				await this.sendMsg(r.message, interaction)
				return
			}

			const song = new Song(r.data)
			const embed = embedAddedSong(song, r.message)
			await this.sendEmbedMsg(embed, 'Added a song to the playlist.', interaction)

			if (this.status !== 'playing') {
				await sleep(1000)
				await this.restoreNowPlaying()
				await this.play()
			} else {
				await this.genUpcoming()
			}
		} catch (e) {
			console.error(e)
			await this.sendMsg('Cannot add the song, please try again!', interaction)
		}
	}

	public async printNowPlaying(interaction: any) {
		try {
			if (!this.nowPlaying) {
				await this.sendMsg('Current song is not available!', interaction)
				return
			}

			const embed = embedNowPlaying(this.nowPlaying)
			await this.sendEmbedMsg(embed, 'This song is playing right now.', interaction)
		} catch (e) {
			console.error(e)
			await this.sendMsg('The bot cannot figure out what song playing right now, sorry.', interaction)
		}
	}

	public async showUpcoming(interaction: any) {
		try {
			const nowPlayingId = this.nowPlaying ? this.nowPlaying.youtubeId : ''
			const r = await request('/upcoming', { nowPlayingId })
			if (r.isOk()) {
				this.playlist = r.data
				const data = embedPlaylist(r.data)
				await this.sendEmbedMsg(data.embed, data.msg, interaction, true)
			} else {
				await this.sendMsg(r.message, interaction)
			}
		} catch (e) {
			console.error(e)
			await this.sendMsg('The bot cannot figure out what song will playing next, sorry.', interaction)
		}
	}

	public async removeFromPlaylist(interaction: any) {
		try {
			const index = interaction.options.getInteger('index')
			const msg = 'Please input a correct index! You can find the index by running command `/u`.'
			if (!this.playlist || !index || this.playlist.length <= index) {
				await this.sendMsg(msg, interaction)
				return
			}

			const song = this.playlist[ index - 1 ]
			if (!song.youtubeId) {
				await this.sendMsg(msg, interaction)
				return
			}

			await this.removeByYtId(song.youtubeId)
			await this.sendMsg(song.title + ' removed from the playlist', interaction)
		} catch (e) {
			console.error(e)
			await this.sendMsg('Cannot connect to the server!', interaction)
		}
	}

	public async setAutoplay(interaction: any) {
		try {
			const state = interaction.options.getString('state')
			const r = await request('/set-autoplay', { state })
			await this.sendMsg(r.message, interaction)
			if (r.isOk() && !!this.nowPlaying) {
				await this.genUpcoming()
			}
		} catch (e) {
			console.error(e)
		}
	}

	public async setPlaylist(interaction: any) {
		try {
			const url = interaction.options.getString('playlist')
			const isShuffle = interaction.options.getBoolean('shuffle')
			const r = await request('/playlist', { url, shuffle: isShuffle ? 'on' : 'off' })
			await this.sendMsg(r.message, interaction)
			if (r.isOk() && !!r.data && (!r.data.status || r.data.status !== 'playing')) {
				await this.restoreNowPlaying()
				await this.play()
			} else if (r.isOk() && r.data.status === 'playing') {
				await this.genUpcoming()
			}
		} catch (e) {
			console.error(e)
		}
	}

	public async clear(interaction: any) {
		const r = await request('/reset')
		if (r.isOk()) {
			await this.sendMsg('Playlist cleared.', interaction)
			this.upcoming = null
		} else {
			await this.sendMsg('Cannot clear playlist!', interaction)
		}
	}

	private async sendMsg(msg: string, interact?: any, isDelete?: boolean) {
		if (interact) {
			await interact.editReply({ embeds: [], content: msg })
			if (isDelete) {
				await sleep(20000)
				await interact.deleteReply()
			}
		} else {
			const channel = await this.client.channels.fetch(MESSAGE_CHANNEL_ID)
			channel[ 'send' ](msg)
		}
	}

	private async sendEmbedMsg(embeddedMsg: EmbedBuilder, msg: string, interact?: any, isDelete?: boolean) {
		if (interact) {
			await interact.editReply({ embeds: [embeddedMsg], content: msg || ' ' })
			if (isDelete) {
				await sleep(20000)
				await interact.deleteReply()
			}
		} else {
			const channel = await this.client.channels.fetch(MESSAGE_CHANNEL_ID)
			channel[ 'send' ]({ embeds: [embeddedMsg] })
		}
	}

}
