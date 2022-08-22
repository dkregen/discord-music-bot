export class Res {
	status: 'success' | 'error'
	message: string
	data: any
	code: number

	constructor(code: number, status: 'success' | 'error', message?: string, data?: any) {
		this.code = code
		this.status = status
		this.message = message
		this.data = data
	}

	public isOk() {
		return this.status === 'success'
	}
}

export function err(msg: string): Res {
	return new Res(400, 'error', msg)
}

export function s(msg?: string | any, data?: string | any): Res {
	return new Res(200, 'success', msg, data)
}

export function d(data: string | any): Res {
	return new Res(201, 'success', 'ok', data)
}
