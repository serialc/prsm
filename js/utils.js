/**
 * Create a random scale free network, used only for testing and demoing
 * Taken from the vis-network distribution
 *
 * Created by Alex on 5/20/2015.
 */
export function getScaleFreeNetwork(nodeCount) {
	var nodes = [];
	var edges = [];
	var connectionCount = [];

	// randomly create some nodes and edges
	for (var i = 0; i < nodeCount; i++) {
		nodes.push({
			id: String(i),
			label: String(i),
			value: 1
		});

		connectionCount[i] = 0;

		// create edges in a scale-free-network way
		if (i == 1) {
			var from = i;
			var to = 0;
			edges.push({
				from: from.toString(),
				to: to.toString()
			});
			connectionCount[from]++;
			connectionCount[to]++;
		} else if (i > 1) {
			var conn = edges.length * 2;
			var rand = Math.floor(seededRandom() * conn);
			var cum = 0;
			var j = 0;
			while (j < connectionCount.length && cum < rand) {
				cum += connectionCount[j];
				j++;
			}

			from = i;
			to = j;
			edges.push({
				from: from.toString(),
				to: to.toString()
			});
			connectionCount[from]++;
			connectionCount[to]++;
		}
	}

	return {
		nodes: nodes,
		edges: edges
	};
}

var randomSeed = 764; // Math.round(Math.random()*1000);
function seededRandom() {
	var x = Math.sin(randomSeed++) * 10000;
	return x - Math.floor(x);
}

export function cleanArray(arr, propsToRemove) {
	return arr.map((item) => {
		return clean(item, propsToRemove)
	})
}

export function clean(source, propsToRemove) {
	// return a copy of an object, with the properties in the object propsToRemove removed
	let out = {};
	for (let key in source) {
		if (!(key in propsToRemove)) out[key] = source[key]
	}
	return out
}

// Performs intersection operation between called set and otherSet 
Set.prototype.intersection = function (otherSet) {
	let intersectionSet = new Set();
	for (var elem of otherSet)
		if (this.has(elem)) intersectionSet.add(elem);
	return intersectionSet;
}


