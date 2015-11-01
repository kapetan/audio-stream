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

	stream.on('header', function(header) {
		// Wave header properties
	});

	stream.on('data', function(data) {
		// Data is a Buffer instance (UInt8Array)
	});

	stream.on('end', function() {
		// End is emitted when media stream has ended
	});

	setTimeout(function() {
		mediaStream.stop();
	}, 5000);
}, function() {
	console.log('Failed to get media');
});
```

The constructor accepts number of channels and microphone volume as options.

#### `stream.destroy([err])`

Destroy the audio stream, releasing all associated resources. The media stream is not closed.

#### `stream.suspend()`

Suspend audio data capturing.

#### `stream.restart()`

Restart audio data capturing.

# Limitations

Currently Chrome lacks supports for capturing a remote stream sent using a peer connection. But works in Firefox.

```javascript
// This only works in Firefox at the moment
peerConnection.onaddstream = function(e) {
	var stream = audio(e.stream);

	stream.on('data', function(data) {

	});
};
```
