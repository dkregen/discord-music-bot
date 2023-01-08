export function timeAge(ms: number, currentTime?: number) {
	const time = currentTime || (new Date()).getTime()
	return Math.round((time - ms) / 1000)
}

export function nextTime(addMs: number, currentTime?: number) {
	const time = currentTime || (new Date()).getTime()
	return (time + addMs)
}
