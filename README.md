# audio-stream

Stream raw audio data from a MediaStream. Only works in modern browsers that support the Web Audio API.

	npm install audio-stream

See the [live recorder demo](http://kapetan.github.io/audio-stream/demo/index.html).

# Usage

Use together with tools similar to browserify. The data is streamed as interleaved 32-bit floats ranging between -1 and 1.

```javascript
var audio = require('audio-stream');

navigator.getUserMedia({
	video: false,
	audio: true
}, function(mediaStream) {
	var stream = audio(mediaStream, {
		channels: 1,
		volume: 0.5
	});

	stream.on('header', function() {
		// Emit wave header proeprties
	});

	stream.on('data', function(data) {
		// Data is a Buffer instance (UInt8Array)
	});
}, function() {
	console.log('Failed to get media');
});
```

The constructor accepts number of channels and microphone volume as options.