var stream = require('stream');
var util = require('util');
var once = require('once');
var extend = require('xtend');

var BIT_DEPTH = 32;

var AudioContext = window.AudioContext || window.webkitAudioContext;
var noop = function() {};

var AudioStream = function(media, options) {
	if(!(this instanceof AudioStream)) return new AudioStream(media, options);
	stream.Readable.call(this);

	options = extend({
		buffer: 2048,
		channels: 2,
		volume: 1
	}, options);

	var self = this;
	var buffer = options.buffer;
	var channels = options.channels;
	var bytesPerSample = BIT_DEPTH / 8;

	self.duration = 0;
	self.samples = 0;

	this._destroyed = false;
	this._stop = noop;
	this._record = once(function() {
		var context = options.context || new AudioContext();
		var source = (media instanceof Audio) ?
			context.createMediaElementSource(media) :
			context.createMediaStreamSource(media);
		var gain = context.createGain();
		var processor = context.createScriptProcessor(buffer, channels, channels);

		gain.gain.value = options.volume;

		var onaudioprocess = processor.onaudioprocess = function(e) {
			var input = e.inputBuffer;
			var numberOfChannels = input.numberOfChannels;
			var numberOfSamples = input.length;
			var data = new Buffer(bytesPerSample * numberOfChannels * numberOfSamples);

			self.duration += input.duration;
			self.samples += numberOfSamples;

			for(var i = 0; i < numberOfChannels; i++) {
				var channel = input.getChannelData(i);

				for(var j = 0; j < numberOfSamples; j++) {
					var offset = bytesPerSample * (j * numberOfChannels + i);
					data.writeFloatLE(channel[j], offset);
				}
			}

			self.push(data);
		};

		self._stop = function() {
			processor.onaudioprocess = null;

			processor.disconnect();
			gain.disconnect();
			source.disconnect();
			if(!options.context) context.close();
		};

		self.on('pause', function() {
			processor.onaudioprocess = null;
		});

		self.on('resume', function() {
			processor.onaudioprocess = onaudioprocess;
		});

		source.connect(gain);
		gain.connect(processor);
		processor.connect(context.destination);

		var sampleRate = context.sampleRate;

		self.emit('header', {
			audioFormat: 3,
			channels: channels,
			sampleRate: sampleRate,
			byteRate: sampleRate * channels * bytesPerSample,
			blockAlign: channels * bytesPerSample,
			bitDepth: BIT_DEPTH
		});
	});
};

util.inherits(AudioStream, stream.Readable);

AudioStream.prototype.destroy = function(err) {
	if(this._destroyed) return;
	this._destroyed = true;

	this._stop();
	if(err) this.emit('error', err);
	this.emit('close');
};

AudioStream.prototype._read = function() {
	this._record();
};

module.exports = AudioStream;
