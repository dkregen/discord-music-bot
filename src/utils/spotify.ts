import { nextTime, timeAge } from './timer'
import Song from './song'
import * as moment from 'moment'
import { similarity } from './common'

const SpotifyWebApi = require('spotify-web-api-node')
const credential = {
	clientId: String(process.env.SPOTIFY_CLIENT_ID),
	clientSecret: String(process.env.SPOTIFY_CLIENT_SECRET),
}

export class Spotify {
	private accessToken: string
	private accessTokenValidUntil: number
	private artists: Array<string> = []

	private async getToken(): Promise<string> {
		if (!this.accessTokenValidUntil || timeAge(this.accessTokenValidUntil, (new Date()).getTime()) >= 0) {
			try {
				const api = new SpotifyWebApi(credential)
				const token = await api.clientCredentialsGrant()
				this.accessToken = token.body[ 'access_token' ]
				this.accessTokenValidUntil = nextTime(100, (new Date()).getTime())
			} catch (e) {
				console.error(e)
			}
		}

		return this.accessToken
	}

	public async getRecommendation(artistName: string): Promise<Song[]> {
		const api = new SpotifyWebApi()
		api.setAccessToken(await this.getToken())
		let artist = undefined

		try {
			const rs = await api.searchArtists(artistName)
			for (const a of rs.body.artists.items) {
				if(similarity(a.name, artistName) === 1) {
					artist = a.id
					break
				}
			}

		} catch (e) {
			console.error('api.searchArtists', this.artists, artistName, e)
			return []
		}

		if (!!artist && !this.artists.includes(artist)) {
			this.artists.push(artist)
			while (this.artists.length > 5) {
				this.artists.splice(0, 1)
			}

			try {
				const songs: Array<Song> = []
				const res = await api.getRecommendations({ min_energy: 0.4, seed_artists: this.artists, min_popularity: 60 })
				console.log(res.body.tracks[ 0 ].album.images)
				for (const t of res.body?.tracks) {
					const song = new Song()
					song.title = t.name
					song.artists = [{ id: t.artists[ 0 ]?.id, name: t.artists[ 0 ]?.name }]
					song.isSpotify = true
					song.isSuggestion = true
					song.isExplicit = Boolean(t.explicit)
					song.album = t.album?.name
					song.thumbnailUrl = t.album?.images?.url ? t.album.images[ t.album.images.length - 1 ].url : 'https://f4.bcbits.com/img/a4139357031_10.jpg'
					const durationSeconds = Math.floor(Number(t.duration_ms) / 1000)
					song.duration = { label: moment.utc(t.duration_ms).format('m:s'), totalSeconds: durationSeconds }
					songs.push(song)
				}

				console.log('SUGGGG', this.artists, songs)
				return songs
			} catch (e) {
				console.error('api.getRecommendations', this.artists, e)
				return []
			}
		}

		return []
	}

	public async isArtistIncluded(artistName: string): Promise<boolean> {
		try {
			const api = new SpotifyWebApi()
			api.setAccessToken(await this.getToken())
			const rs = await api.searchArtists(artistName)
			const artist = rs.body.artists.items[ 0 ].id
			if (this.artists.includes(artist)) {
				return true
			}
		} catch (e) {
			console.error('api.searchArtists', artistName, e)
			return true
		}

		return false
	}
}
