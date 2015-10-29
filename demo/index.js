var audio = require('../');

var getUserMedia = navigator.getUserMedia ||
	navigator.webkitGetUserMedia ||
	navigator.mozGetUserMedia;

var HEADER_LENGTH = 44;

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

var pad = function(n) {
	return n < 10 ? ('0' + n) : n;
};

var header = null;
var buffer = [];
var dataLength = 0;
var stream = null;

var record = document.getElementById('record-button');
var pause = document.getElementById('pause-button');
var stop = document.getElementById('stop-button');
var duration = document.getElementById('duration');
var volume = document.getElementById('volume');

var player = document.getElementById('player');
var download = document.getElementById('download');

record.addEventListener('click', function() {
	volume.setAttribute('disabled', 'disabled');
	record.setAttribute('disabled', 'disabled');
	pause.removeAttribute('disabled');
	stop.removeAttribute('disabled');

	setInterval(function() {
		if(header) {
			var seconds = Math.floor(stream.duration);
			var minutes = Math.floor(seconds / 60);

			duration.innerHTML = pad(minutes) + ':' + pad(seconds - minutes * 60);
		}
	}, 500);

	if(stream) {
		stream.resume();
	} else {
		getUserMedia.call(navigator, {
			video: false,
			audio: true
		}, function(mediaStream) {
			stream = audio(mediaStream, {
				volume: volume.value / 100
			});

			stream.on('header', function(data) {
				header = data;
			});

			stream.on('data', function(data) {
				dataLength += data.length;
				buffer.push(data);
			});
		}, function(err) {
			console.error(err);
		});
	}
});

pause.addEventListener('click', function() {
	record.removeAttribute('disabled');
	pause.setAttribute('disabled', 'disabled');

	stream.pause();
});

stop.addEventListener('click', function() {
	pause.setAttribute('disabled', 'disabled');
	stop.setAttribute('disabled', 'disabled');

	stream.destroy();

	buffer.unshift(writeHeader(dataLength, header));

	var blob = new Blob(buffer, { type: 'audio/wav' });
	var url = URL.createObjectURL(blob);

	player.src = url;
	download.href = url;
	download.classList.remove('hidden');
});
