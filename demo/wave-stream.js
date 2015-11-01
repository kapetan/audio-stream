var stream = require('stream');
var util = require('util');

var HEADER_LENGTH = 44;
var EMPTY_BUFFER = new Buffer(0);
var HIGH_WATER_MARK = Math.pow(2, 14) * 16;

var writeHeader = function(dataLength, options) {
	var header = new Buffer(HEADER_LENGTH);

	header.write('RIFF', 0, 4, 'ascii');
	header.writeUInt32LE(dataLength + HEADER_LENGTH - 8, 4);
	header.write('WAVE', 8, 4, 'ascii');
	header.write('fmt ', 12, 4, 'ascii');
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(options.audioFormat, 20);
	header.writeUInt16LE(options.channels, 22);
	header.writeUInt32LE(options.sampleRate, 24);
	header.writeUInt32LE(options.byteRate, 28);
	header.writeUInt16LE(options.blockAlign, 32);
	header.writeUInt16LE(options.bitDepth, 34);
	header.write('data', 36, 4, 'ascii');
	header.writeUInt32LE(dataLength, 40);

	return header;
};

var WaveStream = function() {
	if(!(this instanceof WaveStream)) return new WaveStream();
	stream.Writable.call(this, { highWaterMark: HIGH_WATER_MARK });

	var self = this;

	this._header = null;
	this._buffer = [EMPTY_BUFFER];
	this._length = 0;

	this.on('pipe', function(src) {
		src.once('header', function(header) {
			self._header = header;
		});
	});

	this.once('finish', function() {
		var buffer = self._buffer;
		buffer[0] = writeHeader(self._length, self._header);

		var blob = new Blob(buffer, { type: 'audio/wav' });
		var url = URL.createObjectURL(blob);

		self.emit('url', url);
	});
};

util.inherits(WaveStream, stream.Writable);

WaveStream.prototype._write = function(data, encoding, callback) {
	this._buffer.push(data);
	this._length += data.length;
	callback();
};

module.exports = WaveStream;
