var events = require('events');
var once = require('once');
var debug = require('debug')('audio-stream:capture');

var noop = function() {};

var isActive = function(media, track) {
	if(media.getAudioTracks) return !!media.getAudioTracks().length;
	if(track) return track.readyState !== 'ended';
	if('active' in media) return media.active;
	if('ended' in media) return media.ended;
	return true;
};

var getAudioTrack = function(media) {
	var track = media.getAudioTracks ? media.getAudioTracks()[0] : null;
	return (track && track.readyState && ('onended' in track)) ? track : null;
};

module.exports = function(media, processor) {
	var that = new events.EventEmitter();
	var track = getAudioTrack(media);

	var hasInactive = ('oninactive' in media);
	var hasEnded = ('onended' in media);
	var hasCurrentTime = ('currentTime' in media) && !hasInactive && !hasEnded;

	var currentTime = -1;
	var lastCall = -1;
	var timeout = null;
	var interval = null;
	var timeBuffer = [];

	var onaudioprocess = function(e) {
		lastCall = Date.now();

		if(hasCurrentTime) {
			// Current time is not updated in Firefox
			// when the media stream is stopped.
			if(currentTime === media.currentTime) {
				debug('current time unchanged', currentTime, !!timeout);

				if(!timeout) timeout = setTimeout(onended, !currentTime ? 5000 : 1000);
				timeBuffer.push(e);
				return;
			}
			if(timeout) {
				debug('current time updated', currentTime, media.currentTime);

				clearTimeout(timeout);
				timeBuffer.forEach(function(entry) {
					that.emit('data', entry);
				});

				timeout = null;
				timeBuffer = [];
			}

			currentTime = media.currentTime;
		}

		that.emit('data', e);
	};

	var onended = once(function(e) {
		debug('onended', (e instanceof Event) ? [e.type, e.target] : null);

		suspend();

		if(track) track.removeEventListener('ended', onended, false);

		if(hasInactive) media.removeEventListener('inactive', onended, false);
		else if(hasEnded) media.removeEventListener('ended', onended, false);

		that.emit('end');
	});

	var scheduleInterval = function() {
		debug('schedule interval');

		// The processor listener is not called in
		// Firefox when the audio track is stopped.
		lastCall = Date.now();
		interval = setInterval(function() {
			if(Date.now() - lastCall > 10000) {
				debug('audio process timeout');
				onended();
			}
		}, 1000);
	};

	var suspend = function() {
		processor.removeEventListener('audioprocess', onaudioprocess, false);
		clearTimeout(timeout);
		clearInterval(interval);
	};

	var restore = function() {
		processor.addEventListener('audioprocess', onaudioprocess, false);
		scheduleInterval();
	};

	that.suspend = suspend;
	that.restore = restore;
	that.destroy = onended;

	if(track) track.addEventListener('ended', onended, false);

	if(hasInactive) media.addEventListener('inactive', onended, false);
	else if(hasEnded) media.addEventListener('ended', onended, false);
	else if(hasCurrentTime) currentTime = media.currentTime;

	restore();

	return that;
};

module.exports.ended = function(media) {
	var track = getAudioTrack(media);
	return !isActive(media, track);
};
