import {
	Client,
	IntentsBitField,
	Partials,
	SlashCommandBuilder,
	Routes,
	EmbedBuilder,
	ActionRowBuilder, SelectMenuBuilder,
} from 'discord.js'
import { REST } from '@discordjs/rest'
import { Player } from './utils/player'
import { sleep } from './utils/common'

const VOICE_CHANNEL_ID = process.env.GROUP_VOICE_CHANNEL_ID || ''
const ADMIN_ID = process.env.GROUP_ADMIN_ID

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN || '')

const client = new Client({
	intents: [
		IntentsBitField.Flags.DirectMessages,
		IntentsBitField.Flags.Guilds,
		IntentsBitField.Flags.GuildBans,
		IntentsBitField.Flags.GuildMessages,
		IntentsBitField.Flags.MessageContent,
		IntentsBitField.Flags.GuildVoiceStates,
		IntentsBitField.Flags.GuildMembers,
	],
	partials: [
		Partials.Channel,
		Partials.Message,
	],
})

const commands = [

	new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with pong!'),

	new SlashCommandBuilder()
		.setName('a')
		.setDescription('Add new song.')
		.addStringOption(option => option.setName('music').setDescription('Enter keywords or Youtube URL').setRequired(true)),

	new SlashCommandBuilder()
		.setName('play')
		.setDescription('Resume stopped/paused song.'),

	new SlashCommandBuilder()
		.setName('stop')
		.setDescription('Stop current playing song.'),

	new SlashCommandBuilder()
		.setName('skip')
		.setDescription('Jump to the next song (Spotify Premium).'),

	new SlashCommandBuilder()
		.setName('ly')
		.setDescription('Show lyrics of current playing song.')
		.addStringOption(option => option.setName('title').setDescription('Enter song title or leave it empty to search lyrics of current playing song.').setRequired(false)),

	new SlashCommandBuilder()
		.setName('np')
		.setDescription('Show information of current playing song.'),

	new SlashCommandBuilder()
		.setName('u')
		.setDescription('Show upcoming playlist.'),

	new SlashCommandBuilder()
		.setName('x')
		.setDescription('Delete song from queue. Use "/u" to find the index of the song')
		.addIntegerOption(option => option.setName('index').setDescription('Enter song index to delete').setRequired(true)),

	new SlashCommandBuilder()
		.setName('set')
		.setDescription('Change system variables.')

		.addSubcommand(subcommand => subcommand
			.setName('clear')
			.setDescription('Wipe out playlist.'))

		.addSubcommand(subcommand => subcommand
			.setName('bypass')
			.setDescription('Allow bypass admin privilege.').addBooleanOption(option => option
				.setName('state')
				.setDescription('Turn On/Off')
				.setRequired(true)))

		.addSubcommand(subcommand => subcommand
			.setName('maxlength')
			.setDescription('Set maximum duration of a song until it skipped automatically.')
			.addIntegerOption(option => option.setName('seconds').setDescription('Input an integer').setRequired(true)))

		.addSubcommand(subcommand => subcommand
			.setName('base')
			.setDescription('Set base playlist.')
			.addStringOption(option => option.setName('playlist')
				.setDescription('Available playlist')
				.setRequired(true)
				.addChoices(
					{
						name: 'Fresh Banger',
						value: 'https://www.youtube.com/watch?v=hJWSZDJb-W4&list=PLmZZvpoUY4HoD5b-Z_L7jRYzjObJR331k',
					},
					{
						name: 'Tropical',
						value: 'https://www.youtube.com/watch?v=uLEM5hO9FXc&list=PLmZZvpoUY4Hq9SXRK06Zh3-O2CK5xO4iw',
					},
					{
						name: 'Gurly',
						value: 'https://www.youtube.com/watch?v=PNoIn1WKiEc&list=PLmZZvpoUY4HqQazCTv1wIhfIG_kNk6TUr',
					},
					{
						name: 'Indo',
						value: 'https://www.youtube.com/watch?v=aE0r5AVrRG0&list=PLmZZvpoUY4Hr3ik2m6A028lJpHKthkhnY',
					},
					{
						name: 'Instrumentals',
						value: 'https://www.youtube.com/watch?v=wf20hL6_4sY&list=PLmZZvpoUY4HqW1AEtBemPjY3sIhRMNnW2',
					},
					{
						name: 'Random Rock',
						value: 'https://www.youtube.com/watch?v=oEeet9t--tI&list=PLmZZvpoUY4HrR4S-MYZGzyS2S6BhREYfl',
					},
					{
						name: '80\'s Jam',
						value: 'https://www.youtube.com/watch?v=1AVxBedMP4I&list=PLmZZvpoUY4Hr-EnwTFAzfl3H2g59yew5L',
					},
					{
						name: '90\'s Jam',
						value: 'https://www.youtube.com/watch?v=tP0zj220CbQ&list=PLmZZvpoUY4Ho3eL-hAt0ZCJHeBnX7GwFN',
					},
					{
						name: '00\'s Jam',
						value: 'https://www.youtube.com/watch?v=bY3vXr7fm8k&list=PLmZZvpoUY4Hr7bvvw0y7CDN7OWQ9n5czn',
					},
					{
						name: '\'1115',
						value: 'https://www.youtube.com/watch?v=6eW99oNNRvI&list=PLmZZvpoUY4HqBfrT6JjcW7LxjuQisjazQ',
					},
					{
						name: '\'1620',
						value: 'https://www.youtube.com/watch?v=fHO158YmpJQ&list=PLmZZvpoUY4Holq8MSMU2S8zoscQ7_Fajp',
					},
				)))

		.addSubcommand(subcommand => subcommand
			.setName('autoplay')
			.setDescription('Set autoplay and add songs based on recommendation.')
			.addBooleanOption(option => option
				.setName('state')
				.setDescription('Turn On/Off')
				.setRequired(true)))

		.addSubcommand(subcommand => subcommand
			.setName('playlist')
			.setDescription('Set playlist outside base playlist.')
			.addStringOption(option => option.setName('playlist').setDescription('Link of Youtube Music playlist').setRequired(true))
			.addBooleanOption(option => option.setName('shuffle')
				.setDescription('Shuffle playlist')
				.setRequired(false))),
].map(command => command.toJSON())

let interact
client.on('ready', async () => {
	try {
		const channel: any = await client.channels.fetch(VOICE_CHANNEL_ID)
		const r = await rest.put(Routes.applicationGuildCommands(process.env.BOT_CLIENT_ID || '', process.env.GROUP_SERVER_ID || ''), { body: commands })
		const player = new Player(channel, client)

		client.on('interactionCreate', async interaction => {

			if (interaction.isSelectMenu()) {
				player.chooseSong(interact, interaction).then()
				interact = undefined
			}

			if (interaction.isChatInputCommand()) {
				const { commandName } = interaction
				switch (commandName) {
					case 'ping':
						await interaction.reply({ ephemeral: true, content: 'Pong!' })
						break
					case 'a':
						await interaction.deferReply()
						while (!!interact) {
							await sleep(1000)
						}

						const isSuggested = await player.suggest(interaction)
						if (!isSuggested) {
							return
						}

						let i = 0
						interact = interaction
						while (i < 10 && !!interact) {
							await sleep(1000)
							console.log(!!interact)
							if (i + 1 >= 10 && !!interact) {
								interact.editReply({ content: 'Time\'s up! :sleeping:', components: [] })
								interact = null
							}
							i++
						}
						break
					case 'play':
						await interaction.deferReply()
						player.play(interaction).then()
						break
					case 'stop':
						await interaction.deferReply()
						player.stop(interaction).then()
						break
					case 'skip':
						await interaction.deferReply()
						player.next(interaction, true).then()
						break
					case 'ly':
						await interaction.deferReply()
						player.findLyrics(interaction).then()
						break
					case 'np':
						await interaction.deferReply()
						player.printNowPlaying(interaction).then()
						break
					case 'u':
						await interaction.deferReply()
						player.showUpcoming(interaction).then()
						break
					case 'x':
						await interaction.deferReply()
						player.removeFromPlaylist(interaction).then()
						break
					case 'set':
						const id = interaction.user.id
						console.log(id, ADMIN_ID)

						switch (interaction.options.getSubcommand()) {
							case 'clear':
								await interaction.deferReply()
								player.clear(interaction, id === ADMIN_ID).then()
								break
							case 'autoplay':
								await interaction.deferReply()
								player.setAutoplay(interaction, id === ADMIN_ID).then()
								break
							case 'volume':
								await interaction.deferReply()
								player.setVolume(interaction, id === ADMIN_ID).then()
								break
							case 'base':
							case 'playlist':
								await interaction.deferReply()
								player.setPlaylist(interaction, id === ADMIN_ID).then()
								break
							case 'maxlength':
								if (id !== ADMIN_ID) {
									console.log(interaction.user.username, 'tried to modify', interaction.options.getSubcommand(), 'and denied!')
									await interaction.reply({
										ephemeral: true,
										content: 'You are not allowed to change system variables because you do not have super admin rights!',
									})
								}

								await interaction.deferReply()
								player.setMaxlength(interaction, id === ADMIN_ID).then()
								return
								break
							case 'bypass':
								if (id !== ADMIN_ID) {
									console.log(interaction.user.username, 'tried to modify', interaction.options.getSubcommand(), 'and denied!')
									await interaction.reply({
										ephemeral: true,
										content: 'You are not allowed to change system variables because you do not have super admin rights!',
									})
									return
								}

								await interaction.deferReply()
								player.setBypass(interaction, id === ADMIN_ID).then()
								break
							default:
								console.log(interaction.options.getSubcommand())
								await interaction.reply('Cannot identify your command. Please type `/` to see available commands!')
						}
						break
					default:
						console.log(commandName)
						await interaction.reply('Cannot identify your command. Please type `/` to see available commands!')
				}
			}
		})

		console.log('This bot is online!')
	} catch (e) {
		console.error(e)
	}
})

client.login(process.env.BOT_TOKEN).then()
