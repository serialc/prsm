/**
 * Some functions for examining and merging maps - not for public consumption, but useful
 * for diagnosing problems and for special operations on maps
 */

import * as Y from 'yjs';
import {WebsocketProvider} from 'y-websocket';
import {DataSet} from 'vis-data/peer';
import {websocket, data, logHistory} from '.prsm.js';
import {uuidv4, deepCopy} from './utils.js';
/* --------------------------------- Merge maps ----------------------------- */
/*
 * Evaluate mergeRoom(string: room code) e.g. mergeRoom('WBI-CRD-ROB-XDK')
 *   adds all factors and links in the 'other' map to this one
 *   if a factor occurs in both maps and is identical in both, nothing is added
 *   if a factor is in both maps, but the label is different, a new factor is added
 *     that is a clone of the 'other' factor, but with a dashed red border and with
 *     cloned links that are dashed.
 */

var bwsp; //  websocket to other room
var bdata; // other room's node and edge data

function openOtherDoc(room) {
	let bDoc = new Y.Doc();
	bwsp = new WebsocketProvider(websocket, 'prsm' + room, bDoc);
	let bNodesMap = bDoc.getMap('nodes');
	let bEdgesMap = bDoc.getMap('edges');
	let bNodes = new DataSet();
	let bEdges = new DataSet();
	bdata = {
		nodes: bNodes,
		edges: bEdges,
	};
	bNodesMap.observe((event) => {
		let nodesToUpdate = [];
		for (let key of event.keysChanged) {
			if (bNodesMap.has(key)) {
				let obj = bNodesMap.get(key);
				nodesToUpdate.push(obj);
			}
		}
		if (nodesToUpdate) bNodes.update(nodesToUpdate);
	});
	bEdgesMap.observe((event) => {
		let edgesToUpdate = [];
		for (let key of event.keysChanged) {
			if (bEdgesMap.has(key)) {
				let obj = bEdgesMap.get(key);
				edgesToUpdate.push(obj);
			}
		}
		bEdges.update(edgesToUpdate, origin);
	});
	return bdata;
}
window.openOtherDoc = openOtherDoc;

function mergeMaps(nodeList, edgeList) {
	// lists of edges from the map to be merged (B) into this one (A)
	let newNodes = new Map();
	nodeList.forEach((BNode) => {
		// for each node in the other map
		let ANode = data.nodes.get(BNode.id); // see whether there is a node in this map with the same id
		if (ANode) {
			// if there is, check whether the label is the same
			if (ANode.label != BNode.label) {
				// if not, make a clone of the other node with a new id
				logHistory(
					`Existing Factor label: '${ANode.label}' does not match new label: '${BNode.label}'. Factor with new label added.`,
					'Merge'
				);
				// generate a new id for BNode.  change border to dashed red.  Add it to the map
				let newNode = deepCopy(BNode);
				newNode.id = uuidv4();
				newNode.shapeProperties.borderDashes = true;
				newNode.borderWidth = 4;
				newNode.borderWidthSelected = 4;
				newNode.color.border = '#ff0000';
				newNode.color.highlight.border = '#ff0000';
				newNode.x = ANode.x + 30;
				newNode.y = ANode.y + 30;
				// add it to this map
				data.nodes.add(newNode);
				// add to lookup table of existing node id to clone node id
				newNodes.set(BNode.id, newNode.id);
			} else if (ANode.grp != BNode.grp)
				// label is the same, but style is not - just report this
				logHistory(
					`Existing style: '${ANode.grp}' does not match new style: '${BNode.grp}' for Factor: '${ANode.label}. Existing style retained.`,
					'Merge'
				);
		} else {
			// the node is on the other map, but not on this one - add it.
			data.nodes.add(BNode);
			logHistory(`Added new Factor: '${BNode.label}'`, 'Merge');
		}
	});

	edgeList.forEach((BEdge) => {
		// Some edges on the other map may have been going to/from nodes that have been cloned and given a new id.
		// Clone these edges, giving them the new from: or to: node ids and make them dashed.
		let newEdge = null;
		if (newNodes.has(BEdge.from)) {
			// this edge goes from a node that has been cloned - adjust the from: id
			newEdge = deepCopy(BEdge);
			newEdge.from = newNodes.get(BEdge.from);
			// it might also go to a cloned node -if so, adjust the to: id
			if (newNodes.has(newEdge.to)) newEdge.to = newNodes.get(newEdge.to);
		} else if (newNodes.has(BEdge.to)) {
			// this edge goes to a cloned node
			newEdge = deepCopy(BEdge);
			newEdge.to = newNodes.get(BEdge.to);
		}
		if (newEdge) {
			// give the cloned edge a new id
			newEdge.id = uuidv4();
			// make the edge dashed
			newEdge.dashes = true;
			data.edges.add(newEdge);
			logHistory(
				`Added Link between new Factor(s): ${data.nodes.get(newEdge.from).label} to ${
					data.nodes.get(newEdge.to).label
				}`,
				'Merge'
			);
		}
		// now deal with the other map's edge
		let AEdge = data.edges.get(BEdge.id);
		let edgeName = BEdge.label || `from ${bdata.nodes.get(BEdge.from).label} to ${bdata.nodes.get(BEdge.to).label}`;
		if (AEdge) {
			if (AEdge.label != BEdge.label)
				logHistory(
					`Existing Link label: \n'${AEdge.label}' \ndoes not match new label: \n'${BEdge.label}'.  Existing label retained.`,
					'Merge'
				);
			else if (AEdge.grp != BEdge.grp)
				logHistory(
					`Existing Link style: '${AEdge.grp}' does not match new style: '${BEdge.grp}' for link '${edgeName}'. Existing style retained.`,
					'Merge'
				);
		} else {
			data.edges.add(BEdge);
			logHistory(`Added new Link: '${edgeName}'`, 'Merge');
		}
	});
}
window.mergeMaps = mergeMaps;

function mergeRoom(room) {
	openOtherDoc(room);
	bwsp.on('sync', () => {
		mergeMaps(bdata.nodes.get(), bdata.edges.get());
	});
}
window.mergeRoom = mergeRoom;
window.bdata = bdata;

/**
 * Print to console the differences between the given map and the current map
 * @param {Dataset} nodeList
 * @param {DataSet} edgeList
 */
function diffMaps(nodeList, edgeList) {
	nodeList.forEach((BNode) => {
		// for each node in the other map
		let ANode = data.nodes.get(BNode.id); // see whether there is a node in this map with the same id
		if (ANode) {
			// if there is, check whether the label is the same
			if (ANode.label != BNode.label) {
				console.log(`Existing Factor label: ${ANode.label} does not match new label: ${BNode.label}.`);
			} else if (ANode.grp != BNode.grp)
				// label is the same, but style is not - just report this
				console.log(
					`Existing style: ${ANode.grp} does not match new style: ${BNode.grp} for Factor: ${ANode.label}. `
				);
		} else {
			// the node is on the other map, but not on this one - add it.
			console.log(`New Factor: ${BNode.label} not in existing map`);
		}
	});
	// now check that all nodes in the existing map are also in the other map
	data.nodes.forEach((ANode) => {
		if (!nodeList.some((BNode) => BNode.id == ANode.id))
			console.log(`Existing factor: ${ANode.label} not in other map`);
	});

	// now deal with the other map's edges
	edgeList.forEach((BEdge) => {
		let AEdge = data.edges.get(BEdge.id);
		let edgeName = BEdge.label || `from ${bdata.nodes.get(BEdge.from).label} to ${bdata.nodes.get(BEdge.to).label}`;
		if (AEdge) {
			if (AEdge.label != BEdge.label)
				console.log(`Existing Link label: \n${AEdge.label} \ndoes not match new label: \n${BEdge.label}.  `);
			else if (AEdge.grp != BEdge.grp)
				logHistory(
					`Existing Link style: '${AEdge.grp}' does not match new style: '${BEdge.grp}' for link '${edgeName}'. `
				);
		} else {
			logHistory(`Existing map does not include Link: '${edgeName}'`);
		}
	});
}
function diffRoom(room) {
	openOtherDoc(room);
	bwsp.on('sync', () => {
		diffMaps(bdata.nodes.get(), bdata.edges.get());
	});
}
window.diffRoom = diffRoom;
