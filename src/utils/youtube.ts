import Song from './song'
import * as ytdl from 'ytdl-core'
import { YTvideo } from 'ytfps/out/interfaces'
import { searchMusics } from 'node-youtube-music'
import axios from 'axios'
import { shuffle, similarity } from './common'
import * as moment from 'moment/moment'
import { searchVideo } from './youtube-parser'

const ytfps = require('ytfps')
const YT_KEY = process.env.YOUTUBE_API_KEY

export async function ytRetrievePlaylist(youtubeId: string, isShuffle: boolean): Promise<Array<Song>> {
	try {
		const songs: Array<Song> = []
		const yt = await ytfps(youtubeId, 'url')
		yt.videos.forEach((vid: YTvideo) => {
			const s = new Song()
			const authorUrl = vid.author.url.split('/')
			s.title = vid.title
			s.duration.totalSeconds = Math.round(Number(vid.milis_length / 1000))
			s.duration.label = moment.utc(Number(vid.milis_length)).format('m:s')
			s.youtubeId = vid.id
			s.thumbnailUrl = vid.thumbnail_url
			s.artists.push({
				id: authorUrl[ authorUrl.length - 1 ] || '0',
				name: vid.author.name.split(' - Topic')[ 0 ],
			})

			if (!s.isEmpty()) {
				songs.push(s)
			}
		})

		if (isShuffle) {
			shuffle(songs)
		}

		return songs
	} catch (e) {
		console.error(e)
		return []
	}
}

export async function ytSelect(query: string, preparedTitle?: string): Promise<Song | undefined> {
	try {
		const r = await searchMusics(query)
		if (r.length > 0) {
			if (!preparedTitle) {
				const song = new Song(r[ 0 ])
				song.isYtMusic = true
				return song
			} else {
				for (const s of r) {
					const song = new Song(s)
					const similarIndex = similarity(song.title, preparedTitle)
					console.log(song.title, similarIndex)
					if (similarIndex > 0.6) {
						return song
					}
				}
			}
		}
	} catch (e) {
		console.error(e)
	}

	return undefined
}

export async function ytSuggestions(reference: Song): Promise<Array<Song>> {
	try {

		const youtubeId = reference.youtubeId
		const r2 = await axios.get('https://www.googleapis.com/youtube/v3/search', {
			params: {
				'relatedToVideoId': youtubeId,
				'type': 'video',
				'videoCategoryId': '10',
				'topicId': '/m/04rlf',
				'regionCode': 'id',
				'videoDuration': 'short',
				'part': 'snippet',
				'maxResults': '100',
				'key': YT_KEY,
			},
		})

		const chosen = []
		const chosenObj = []
		for (let i = 0; i < r2.data.items.length; i++) {
			const related = r2.data.items[ i ]

			if (!!related.snippet) {
				chosenObj.push(related)
				chosen.push(related.id.videoId)
			}

			if (chosen.length >= 45) {
				break
			}
		}

		if (chosen.length > 0) {
			const r2 = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
				params: {
					part: 'contentDetails',
					id: chosen.join(','),
					key: YT_KEY,
				},
			})

			const songs = []
			for (let i = 0; i < r2.data.items.length; i++) {
				const vid = r2.data.items[ i ]
				const duration = moment.duration(vid.contentDetails.duration).asSeconds()
				if (duration < 390 && duration > 30) {
					const song = new Song()
					for (let i = 0; i < chosenObj.length; i++) {
						if (chosenObj[ i ].id.videoId === vid.id) {
							const snippet = chosenObj[ i ].snippet
							song.title = snippet.title
							song.youtubeId = vid.id
							song.isSuggestion = true
							for (let key in snippet.thumbnails) {
								song.thumbnailUrl = snippet.thumbnails[ key ].url
								break
							}
							song.artists = [{
								name: snippet.channelTitle,
								id: snippet.channelId,
							}]
							song.duration = {
								label: moment.utc(Number(duration) * 1000).format('m:s'),
								totalSeconds: duration,
							}
							songs.push(song)
							break
						}
					}
				}
			}

			console.log('Autoplay', songs)
			return songs
		}

		return []
	} catch (e) {
		console.error(e)
		return undefined
	}
}

export async function ytSearch(query): Promise<Song[]> {
	const songs = []
	query = query + ' official audio'
	console.log('suggestion query', query)

	try {
		const results: any = await searchVideo(query)

		for (let i = 0; i < results.length; i++) {
			const search = results[ i ]
			if (search.snippet) {
				console.log('Got', search)
				const snippet = search.snippet
				const song = new Song()
				song.title = snippet.title
				song.youtubeId = search.id?.videoId
				song.isSuggestion = true
				song.thumbnailUrl = snippet.thumbnails?.url
				song.artists = []
				song.duration = {
					label: snippet?.duration,
					totalSeconds: 0,
				}
				songs.push(song)
			}
		}

		console.log(songs)
	} catch (e) {
		console.error(e)
	}

	return songs
}

export async function ytRetrieve(ytId): Promise<Song[]> {
	const songs = []
	const r = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
		params: {
			'id': ytId,
			'key': YT_KEY,
			'part': 'snippet',
		},
	})

	for (let i = 0; i < r.data.items.length; i++) {
		const search = r.data.items[ i ]
		if (search.snippet) {
			const snippet = search.snippet
			const song = new Song()
			song.title = snippet.title
			song.youtubeId = search.id
			song.isSuggestion = true
			for (let key in snippet.thumbnails) {
				song.thumbnailUrl = snippet.thumbnails[ key ].url
				break
			}
			song.artists = [{
				name: snippet.channelTitle,
				id: snippet.channelId,
			}]
			song.duration = {
				label: moment.utc(Number(0) * 1000).format('m:s'),
				totalSeconds: 0,
			}
			songs.push(song)
		}
	}

	return songs
}

export async function ytMetadata(link: string): Promise<Song | undefined> {
	try {
		const data = await ytdl.getBasicInfo(link)
		console.log(data)
		const song = new Song()
		song.title = data.videoDetails.title
		song.duration.totalSeconds = Number(data.videoDetails.lengthSeconds)
		song.duration.label = moment.utc(song.duration.totalSeconds * 1000).format('m:s')
		song.youtubeId = data.videoDetails.videoId
		song.thumbnailUrl = data.videoDetails.thumbnails[ data.videoDetails.thumbnails.length - 2 ].url
		song.artists.push({
			id: data.videoDetails.author.id,
			name: data.videoDetails.author.name.split(' - Topic')[ 0 ],
		})

		return song
	} catch (e) {
		console.error(e)
		return undefined
	}
}
