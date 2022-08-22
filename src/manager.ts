import express = require('express')
import { s } from './utils/res'
import PlaylistManager from './utils/playlist-manager'

const app = express()
const port = 3000
const playlist = new PlaylistManager()

app.get('/ping', (req, res) => {
	res.json(s('Pong!'))
})

app.get('/status', async (req, res) => {
	try {
		const r = playlist.getStatus()
		console.log('/status', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/np', async (req, res) => {
	try {
		const r = await playlist.nowPlaying()
		console.log('/np', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/up-next', async (req, res) => {
	try {
		const npId = req.query.youtubeId
		const r = await playlist.nextSong(npId)
		console.log('/up-next', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/reset', async (req, res) => {
	try {
		const r = await playlist.clearPlaylist()
		console.log('/reset', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/delete', async (req, res) => {
	try {
		const youtubeId = req.query.youtubeId
		const r = await playlist.delete(youtubeId)
		console.log('/delete', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/add', async (req, res) => {
	try {
		const query = req.query.query
		const username = req.query.username
		const id = req.query.id
		const avatar = req.query.avatar
		const nowPlayingId = req.query.nowPlayingId
		const r = await playlist.add(query, username, id, avatar, nowPlayingId)
		console.log('/add', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/set-status', async (req, res) => {
	try {
		const r = await playlist.setStatus(req.query.status)
		console.log('/set-status', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/set-autoplay', async (req, res) => {
	try {
		const r = await playlist.setAutoplay(req.query.state)
		console.log('/set-autoplay', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/get-autoplay', async (req, res) => {
	try {
		const r = await playlist.getAutoplayState()
		console.log('/get-autoplay', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/set-maxlength', async (req, res) => {
	try {
		const r = playlist.setMaxlength(req.query.length)
		console.log('/set-maxlength', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/get-maxlength', async (req, res) => {
	try {
		const r = await playlist.getMaxlength()
		console.log('/get-maxlength', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/upcoming', async (req, res) => {
	try {
		const nowPlayingId = req.query.nowPlayingId
		const r = playlist.showUpcoming(nowPlayingId)
		console.log('/upcoming', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/playlist', async (req, res) => {
	try {
		const r = await playlist.setPlaylist(req.query.url)
		console.log('/playlist', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/rm', async (req, res) => {
	try {
		const r = playlist.removeFromPlaylist(req.query.index)
		console.log('/rm', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.get('/data', async (req, res) => {
	try {
		const r = playlist.getData()
		console.log('/data', r)
		res.status(r.code).json(r)
	} catch (e) {
		console.error(e)
		res.status(500).send()
	}
})

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`)
})
