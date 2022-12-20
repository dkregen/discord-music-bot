const arr = [1,4,2,1,4,2]
const id = 2

function findIndex(id: number) {
	let lastIndex = -1

	// Find in the array if the ID already registered and use it as starting point.
	for (let i = arr.length - 1; i >= 0; i--) {
		if (id === arr[ i ]) {
			lastIndex = i
			break
		}
	}

	// Find the duplicated ID. If found, return it.
	for (let i = lastIndex + 1; i < arr.length; i++) {
		for (let j = i + 1; j < arr.length; j++) {
			if(arr[i] === arr[j]) {
				// Found duplicated ID!
				return j
			}
		}
	}

	return -1
}

console.log('ID index:', findIndex(id))
