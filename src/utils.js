'use strict';

import Chart from 'chart.js';

var helpers = Chart.helpers;

var devicePixelRatio = typeof window !== 'undefined'
	? window.devicePixelRatio
	: 1;

var isUndefined = function(a) {
	return a === undefined;
};

var utils = {
	// @todo move this in Chart.helpers.toTextLines
	toTextLines: function(inputs) {
		var lines = [];
		var input;

		inputs = [].concat(inputs);
		while (inputs.length) {
			input = inputs.pop();
			if (typeof input === 'string') {
				lines.unshift.apply(lines, input.split('\n'));
			} else if (Array.isArray(input)) {
				inputs.push.apply(inputs, input);
			} else if (!helpers.isNullOrUndef(inputs)) {
				lines.unshift('' + input);
			}
		}

		return lines;
	},

	// @todo move this method in Chart.helpers.canvas.toFont (deprecates helpers.fontString)
	// @see https://developer.mozilla.org/en-US/docs/Web/CSS/font
	toFontString: function(font) {
		if (!font || helpers.isNullOrUndef(font.size) || helpers.isNullOrUndef(font.family)) {
			return null;
		}

		return (font.style ? font.style + ' ' : '')
			+ (font.weight ? font.weight + ' ' : '')
			+ font.size + 'px '
			+ font.family;
	},

	// @todo move this in Chart.helpers.canvas.textSize
	// @todo cache calls of measureText if font doesn't change?!
	textSize: function(ctx, lines, font) {
		var items = [].concat(lines);
		var ilen = items.length;
		var prev = ctx.font;
		var width = 0;
		var i;

		ctx.font = font.string;

		for (i = 0; i < ilen; ++i) {
			width = Math.max(ctx.measureText(items[i]).width, width);
		}

		ctx.font = prev;

		return {
			height: ilen * font.lineHeight,
			width: width
		};
	},

	// @todo move this method in Chart.helpers.options.toFont
	parseFont: function(value) {
		var global = Chart.defaults.global;
		var size = helpers.valueOrDefault(value.size, global.defaultFontSize);
		var font = {
			family: helpers.valueOrDefault(value.family, global.defaultFontFamily),
			lineHeight: helpers.options.toLineHeight(value.lineHeight, size),
			size: size,
			style: helpers.valueOrDefault(value.style, global.defaultFontStyle),
			weight: helpers.valueOrDefault(value.weight, null),
			string: ''
		};

		font.string = utils.toFontString(font);
		return font;
	},

	/**
	 * Returns value bounded by min and max. This is equivalent to max(min, min(value, max)).
	 * @todo move this method in Chart.helpers.bound
	 * https://doc.qt.io/qt-5/qtglobal.html#qBound
	 */
	bound: function(min, value, max) {
		return Math.max(min, Math.min(value, max));
	},

	/**
	 * Returns an array of pair [value, state] where state is:
	 * * -1: value is only in a0 (removed)
	 * *  1: value is only in a1 (added)
	 */
	arrayDiff: function(a0, a1) {
		var prev = a0.slice();
		var updates = [];
		var i, j, ilen, v;

		for (i = 0, ilen = a1.length; i < ilen; ++i) {
			v = a1[i];
			j = prev.indexOf(v);

			if (j === -1) {
				updates.push([v, 1]);
			} else {
				prev.splice(j, 1);
			}
		}

		for (i = 0, ilen = prev.length; i < ilen; ++i) {
			updates.push([prev[i], -1]);
		}

		return updates;
	},

	/**
	 * https://github.com/chartjs/chartjs-plugin-datalabels/issues/70
	 */
	rasterize: function(v) {
		return Math.round(v * devicePixelRatio) / devicePixelRatio;
	},

	/**
	 * Helper function to determine whether there is an intersection between the two polygons described
	 * by the lists of vertices. Uses the Separating Axis Theorem
	 *
	 * @param a an array of connected points [{x:, y:}, {x:, y:},...] that form a closed polygon
	 * @param b an array of connected points [{x:, y:}, {x:, y:},...] that form a closed polygon
	 * @return true if there is any intersection between the 2 polygons, false otherwise
	 */
	doPolygonsIntersect: function(a, b) {
		var polygons = [a, b];
		var i, i1;

		for (i = 0; i < polygons.length; i++) {

			// for each polygon, look at each edge of the polygon, and determine if it separates
			// the two shapes
			var polygon = polygons[i];
			for (i1 = 0; i1 < polygon.length; i1++) {

				// grab 2 vertices to create an edge
				var i2 = (i1 + 1) % polygon.length;
				var p1 = polygon[i1];
				var p2 = polygon[i2];

				// find the line perpendicular to this edge
				var normal = {x: p2.y - p1.y, y: p1.x - p2.x};

				var projectionA = utils.projectVertex(a, normal);
				var projectionB = utils.projectVertex(b, normal);

				// if there is no overlap between the projects, the edge we are looking at separates the two
				// polygons, and we know there is no overlap
				if (projectionA.max < projectionB.min || projectionB.max < projectionA.min) {
					return false;
				}
			}
		}
		return true;
	},

	/**
	 * For each vertex in the shape, project it onto the line perpendicular to the edge
	 * and keep track of the min and max of these values
	 */
	projectVertex: function(shape, normal) {
		var i, projected, min, max;

		min = max = undefined;

		for (i = 0; i < shape.length; i++) {
			projected = normal.x * shape[i].x + normal.y * shape[i].y;
			if (isUndefined(min) || projected < min) {
				min = projected;
			}
			if (isUndefined(max) || projected > max) {
				max = projected;
			}
		}

		return {min: min, max: max};
	},

	rotatePolygon: function(center, polygon, rotation) {
		var newPolygon = [];
		var ilen = polygon.length;
		var i;

		for (i = 0; i < ilen; ++i) {
			var point = polygon[i];
			newPolygon.push(utils.rotatePoint(center, {x: point.x, y: point.y}, rotation));
		}

		return newPolygon;
	},

	rotatePoint: function(center, point, rotation) {
		var cos = Math.cos(rotation);
		var sin = Math.sin(rotation);
		var nx = (cos * (point.x - center.x)) + (sin * (point.y - center.y)) + center.x;
		var ny = (cos * (point.y - center.y)) - (sin * (point.x - center.x)) + center.y;

		return {x: nx, y: ny};
	}
};

export default utils;
