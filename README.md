# audiomonkey
A simple audio library using the Web Audio API. You can play, stop, pause, loop, change the volume and the playback rate of your audio files.

var audioMonkey = new AudioMonkey();
audioMonkey.init();

audioMonkey.add("sound", { ogg: '/sounds/sound.ogg', mp3: '/sounds/sound.mp3' });

audioMonkey.stopAll();
audioMonkey.pauseAll();
audioMonkey.resumeAll();

// ID of the audio file, start offset, time Offset, rate, loop, loopStart, loopEnd, volume
audioMonkey.play("sound", 0, 0, 3, true);

audioMonkey.rate("sound", 3);
audioMonkey.volume("sound", 0.5);

audioMonkey.stop("sound");
