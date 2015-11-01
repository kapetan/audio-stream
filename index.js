var stream = require('stream');
var util = require('util');
var once = require('once');
var extend = require('xtend');
var debug = require('debug')('audio-stream');

var capture = require('./capture');

var BIT_DEPTH = 32;
var SAMPLE_RATE = 44100;
var HIGH_WATER_MARK = Math.pow(2, 14) * 16;

var AudioContext = window.AudioContext || window.webkitAudioContext;
var noop = function() {};

var AudioStream = function(media, options) {
	if(!(this instanceof AudioStream)) return new AudioStream(media, options);
	stream.Readable.call(this, { highWaterMark: HIGH_WATER_MARK });

	options = extend({
		buffer: 2048,
		channels: 2,
		volume: 1
	}, options);

	var self = this;
	var buffer = options.buffer;
	var channels = options.channels;
	var bytesPerSample = BIT_DEPTH / 8;

	this.duration = 0;
	this.samples = 0;

	this._destroyed = false;
	this._suspend = noop;
	this._restore = noop;
	this._stop = noop;
	this._record = once(function() {
		if(capture.ended(media)) {
			debug('ended before data');

			self._emitHeader(SAMPLE_RATE, channels);
			return self.push(null);
		}

		var context = options.context || new AudioContext();
		var source = (media instanceof Audio) ?
			context.createMediaElementSource(media) :
			context.createMediaStreamSource(media);
		var gain = context.createGain();
		var processor = context.createScriptProcessor(buffer, channels, channels);

		var that = capture(media, processor);

		gain.gain.value = options.volume;

		that.on('data', function(e) {
			var input = e.inputBuffer;
			var numberOfChannels = input.numberOfChannels;
			var numberOfSamples = input.length;
			var data = new Buffer(bytesPerSample * numberOfChannels * numberOfSamples);

			for(var i = 0; i < numberOfChannels; i++) {
				var channel = input.getChannelData(i);

				for(var j = 0; j < numberOfSamples; j++) {
					var offset = bytesPerSample * (j * numberOfChannels + i);
					data.writeFloatLE(channel[j], offset);
				}
			}

			self.duration += input.duration;
			self.samples += numberOfSamples;
			self.push(data);
		});

		that.on('end', function() {
			self._stop();
			self.push(null);
		});

		self._suspend = function() {
			debug('suspend');
			that.suspend();
		};

		self._restore = function() {
			debug('restore');
			that.restore();
		};

		self._stop = function() {
			debug('stop');

			that.destroy();

			processor.disconnect();
			gain.disconnect();
			source.disconnect();
			if(!options.context) context.close();
		};

		self.on('end', function() {
			debug('end');
		});

		self.on('pause', function() {
			debug('pause');
		});

		self.on('resume', function() {
			debug('resume');
		});

		source.connect(gain);
		gain.connect(processor);
		processor.connect(context.destination);

		self._emitHeader(context.sampleRate, channels);
	});
};

util.inherits(AudioStream, stream.Readable);

AudioStream.prototype.suspend = function() {
	this._suspend();
};

AudioStream.prototype.restore = function() {
	this._restore();
};

AudioStream.prototype.destroy = function(err) {
	debug('destroy', err);

	if(this._destroyed) return;
	this._destroyed = true;

	this._stop();
	if(err) this.emit('error', err);
	this.emit('close');
};

AudioStream.prototype._read = function() {
	this._record();
};

AudioStream.prototype._emitHeader = function(sampleRate, channels) {
	var bytesPerSample = BIT_DEPTH / 8;

	this.emit('header', {
		audioFormat: 3,
		channels: channels,
		sampleRate: sampleRate,
		byteRate: sampleRate * channels * bytesPerSample,
		blockAlign: channels * bytesPerSample,
		bitDepth: BIT_DEPTH
	});
};

module.exports = AudioStream;
