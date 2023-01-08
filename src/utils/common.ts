import { EmbedBuilder, ButtonStyle } from 'discord.js'
import Song from './song'
import { err, Res } from './res'
import axios from 'axios'

const DEFAULT_URL = 'http://localhost:'+process.env.MANAGER_PORT

export function sleep(ms: number) {
	return new Promise((res) => {
		setTimeout(() => {
			res(true)
		}, ms)
	})
}

export function isValidHttpUrl(uri: string) {
	let url

	try {
		url = new URL(uri)
	} catch (e) {
		return false
	}

	return url.protocol === 'http:' || url.protocol === 'https:'
}

export function embedAddedSong(song: Song, msg: string): EmbedBuilder {
	const artist = song.artists.length ? song.artists[ 0 ].name : 'Youtube'
	const artistId = song.artists.length ? song.artists[ 0 ].id : '0'
	const urlMedia = `https://www.youtube.com/watch?v=${ song.youtubeId }`
	const urlIcon = `https://ui-avatars.com/api/?background=random&name=${ encodeURIComponent(artist) }`
	const urlArtist = `https://music.youtube.com/channel/${ artistId }`
	const decoratorMsg = song.isExplicit ? '💢' : song.isYtMusic ? '🎯' : !song.requestBy ? '🤖' : '😐'
	const embed = new EmbedBuilder()
		.setTitle(song.title)
		.setURL(urlMedia)
		.setAuthor({
			name: artist + ' ' +decoratorMsg,
			iconURL: urlIcon,
			url: urlArtist,
		})
		.setThumbnail(song.thumbnailUrl)
		.setDescription(msg || '-')

	if(song.isYtMusic) {
		embed.setColor('#c3352e')
	} else if(song.isSpotify) {
		embed.setColor('#1DB954')
	}

	return embed
}

export function embedNowPlaying(song: Song): EmbedBuilder {
	const artistName = (song.artists.length ? song.artists[ 0 ].name : 'Youtube')
	const decoratorMsg = song.isExplicit ? '💢' : song.isYtMusic ? '🎯' : !song.requestBy ? '🤖' : '😐'
	console.log(song.thumbnailUrl, song.title, `https://www.youtube.com/watch?v=${ song.youtubeId }`, `https://ui-avatars.com/api/?background=random&name=${ artistName.split(' ').join('+') }`, `https://music.youtube.com/channel/${ song.artists.length ? song.artists[ 0 ].name : 0 }`)
	const embed = new EmbedBuilder()
		.setTitle(song.title)
		.setURL(`https://www.youtube.com/watch?v=${ song.youtubeId }`)
		.setAuthor({
			name: artistName + ' ' + decoratorMsg,
			iconURL: `https://ui-avatars.com/api/?background=random&name=${ artistName.split(' ').join('+') }`,
			url: `https://music.youtube.com/channel/${ song.artists.length ? song.artists[ 0 ].name : 0 }`,
		})
		.setThumbnail(song.thumbnailUrl)
		.addFields(
			{ name: 'Duration', value: song.duration.label, inline: true },
			{ name: 'Album', value: song.album || '-', inline: true },
			{ name: 'Language', value: song.isExplicit ? 'Explicit Content' : '-', inline: false },
		)
		.addFields({ name: '\u200B', value: '\u200B', inline: false })
		.setFooter({
			text: song.requestBy ? 'Requested by ' + song.requestBy.name + '.' : 'Added by the bots.',
			iconURL: song.requestBy ? song.requestBy.avatar : `https://ui-avatars.com/api/?background=random&name=Bots`,
		})

	if(song.isYtMusic) {
		embed.setColor('#c3352e')
	} else if(song.isSpotify) {
		embed.setColor('#1DB954')
	}

	return embed
}

export function embedPlaylist(songs: Array<Song>): { msg: string, embed: EmbedBuilder | undefined } {

	if (songs.length <= 0) {
		return { msg: 'No upcoming song! Please add songs to the playlist using command `/a`', embed: undefined }
	}

	let text = ''
	for (let i = 0; i < songs.length; i++) {
		const song = songs[ i ]
		text += `${ i + 1 }. ${ song.requestBy && song.requestBy.name ? '**(' +song.requestBy.name + ')** ' : '' }${ song.title }\r\n`

		if (i === 99) {
			break
		}
	}

	let embed = new EmbedBuilder()
		.setDescription(text)

	return { msg: 'Upcoming Playlist. Type `/set clear` to wipe out the playlist', embed }
}

export async function request(uri: string, params?: any): Promise<Res> {
	try {
		const { data } = await axios.get(`${ DEFAULT_URL }${ uri }`, { params })
		if (!!data) {
			return new Res(data.code, data.status, data.message, data.data)
		} else {
			throw 'empty response'
		}
	} catch (e) {
		console.error(e.toString())
		return err('Cannot process your request!')
	}
}

export function shuffle(array) {
	let currentIndex = array.length, randomIndex

	// While there remain elements to shuffle.
	while (currentIndex != 0) {

		// Pick a remaining element.
		randomIndex = Math.floor(Math.random() * currentIndex)
		currentIndex--;

		// And swap it with the current element.
		[array[ currentIndex ], array[ randomIndex ]] = [
			array[ randomIndex ], array[ currentIndex ]]
	}

	return array
}

export function embedLyrics(o: { author: string, title: string, content: string } | null): { msg: string, embed: EmbedBuilder | undefined } {

	if (!o) {
		return { msg: 'Lyrics not found!', embed: undefined }
	}

	const embed = new EmbedBuilder()
		.setTitle(o.title)
		.setDescription(o.content.substring(0, 4090))
		.addFields({ name: '\u200B', value: '\u200B', inline: false })
		.setFooter({
			text: o.author ? 'Made Famous by ' + o.author + '.' : 'Unknown Author.',
			iconURL: `https://ui-avatars.com/api/?background=random&name=${ encodeURIComponent(o.author || 'Unknown Author') }`,
		})

	return { msg: 'Found the lyrics!', embed }
}

export function similarity(s1, s2) {
	var longer = s1;
	var shorter = s2;
	if (s1.length < s2.length) {
		longer = s2;
		shorter = s1;
	}
	var longerLength = longer.length;
	if (longerLength == 0) {
		return 1.0;
	}
	return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
	s1 = s1.toLowerCase();
	s2 = s2.toLowerCase();

	var costs = new Array();
	for (var i = 0; i <= s1.length; i++) {
		var lastValue = i;
		for (var j = 0; j <= s2.length; j++) {
			if (i == 0)
				costs[j] = j;
			else {
				if (j > 0) {
					var newValue = costs[j - 1];
					if (s1.charAt(i - 1) != s2.charAt(j - 1))
						newValue = Math.min(Math.min(newValue, lastValue),
							costs[j]) + 1;
					costs[j - 1] = lastValue;
					lastValue = newValue;
				}
			}
		}
		if (i > 0)
			costs[s2.length] = lastValue;
	}
	return costs[s2.length];
}
