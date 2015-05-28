
function log() {
    var str = "";
    
    if(window.loglevel == undefined) window.loglevel = 0;
    
    function getErrorObject(){
        try { throw Error('') } catch(err) { return err; }
    }

    var err = getErrorObject();
    var caller_line = err.stack ? err.stack.split("\n")[4] : "";
    var index = caller_line.indexOf("at ");
    var clean = caller_line.slice(index+2, caller_line.length);

    if(arguments[0] == "error" || (arguments[0] == "warning" && window.loglevel > 0) || (arguments[0] == "info" && window.loglevel > 1)) {
        for(var i=0; i<arguments.length; i++) {
            str += typeof arguments[i] == "object" ? JSON.stringify(arguments[i]) : arguments[i];

            if(i<arguments.length-1) str += ", ";
        }

        if(typeof console != "undefined") {
            console.log(clean, str);
        }//if
    }//if
}

function AudioMonkey() {
    this.class = "AudioMonkey";

    AudioBufferSourceNode.prototype.FINISHED_STATE = 3;
    AudioBufferSourceNode.prototype.PLAYING_STATE = 2;
    AudioBufferSourceNode.prototype.SCHEDULED_STATE = 1;
    AudioBufferSourceNode.prototype.UNSCHEDULED_STATE = 0;

    this.FADE_TIME = 1;
    this.FREQ_MUL = 7000;
    this.QUAL_MUL = 30;

    this.context = false;

    this.manifest = {
    };

    this.format = (new Audio().canPlayType('audio/ogg') !== '' ? 'ogg' : 'mp3');
    
    this.sounds = {
        /*sound: false,
         buffer: false,
         gain: false,
         loaded: false*/
    };

    this.init = function() {
        try {
            this.stopAll();

            if(!this.context) {
                // Fix up for prefixing
                window.AudioContext = window.AudioContext||window.webkitAudioContext;
                this.context = new AudioContext();
            }//if

            //log("info", this.class, "init:", this.manifest);

            for(var i in this.manifest) {
                this.load(i, this.manifest[i]);
            }//for
        }//try
        catch(e) {
            //log("error", 'Web Audio API is not supported in this browser', e);
        }//catch
    };

    this.syncStream = function(node){ // should be done by api itself. and hopefully will.
        try {
            var buf8 = new Uint8Array(node.response);
            buf8.indexOf = Array.prototype.indexOf;
            var i=node.sync, b=buf8;

            while(1) {
                node.retry++;
                i=b.indexOf(0xFF,i); if(i==-1 || (b[i+1] & 0xE0 == 0xE0 )) break;
                i++;
            }

            if(i!=-1) {
                var tmp=node.response.slice(i); //careful there it returns copy
                delete(node.response); node.response=null;
                node.response=tmp;
                node.sync=i;
                
                return true;
            }
        } catch(err) {
            log("error", err);
        }

        return false;
    };

    this.cloneAudioBuffer = function(audioBuffer) {
        try {
            var channels = [],
                processed = 0,
                numChannels = audioBuffer.numberOfChannels;

            //clone the underlying Float32Arrays
            for (var i = 0; i < numChannels; i++){
                try {
                    channels[i] = new Float32Array(audioBuffer.getChannelData(i));

                    processed++;
                } catch(err) {
                    //log("error", err);
                }// catch
            }

            //create the new AudioBuffer (assuming AudioContext variable is in scope)
            var newBuffer = this.context.createBuffer(
                audioBuffer.numberOfChannels,
                audioBuffer.length,
                audioBuffer.sampleRate
            );

            //copy the cloned arrays to the new AudioBuffer
            for (var i = 0; i < numChannels; i++){
                try {
                    newBuffer.getChannelData(i).set(channels[i]);
                } catch(err) {
                    //log("error", err);
                }// catch
            }

            return newBuffer;
        } catch(err) {
            log("error", err);

            return false;
        }
    };

    this.decode = function(id, request) {
        var that = this;

        /*
        var onError = function(err) {
            if(that.syncStream(request) && request.retry < 10) {
                that.decode(id, request);
            } else {
                //log("error", that.class, "audio load error", err);

                that.sounds[id].buffer = that.context.createBuffer(request.response, false);
                that.sounds[id].loaded = true;
            }//else
        };
        */
        
        that.context.decodeAudioData(request.response, function(buffer) {
            if(typeof that.sounds[id] != "undefined") {
                that.sounds[id].buffer = buffer;
                that.sounds[id].loaded = true;
            }//if
        }, function(e) {
            /*
            if(that.syncStream(request) && request.retry < 10) {
                that.decode(id, request);
            }//if
            
            that.sounds[id].buffer = that.context.createBuffer(request.response, true);
            that.sounds[id].loaded = true;
            */
        });
    };

    this.stopAll = function() {
        //log("info", this.class,"stopAll");

        for(var id in this.sounds) {
            this.stop(id);
        }//for
    };

    this.pauseAll = function() {
        //log("info", this.class,"stopAll");

        for(var id in this.sounds) {
            try {
                this.sounds[id].pausedAt = Date.now();

                if(typeof this.sounds[id] == "undefined" || !this.sounds[id].loaded || !this.sounds[id].sound || (this.sounds[id].sound && this.sounds[id].sound.playbackState && this.sounds[id].sound.playbackState == AudioBufferSourceNode.FINISHED_STATE)) continue;

                if (!this.sounds[id].sound.stop)
                    this.sounds[id].sound.stop = this.sounds[id].sound.noteOff;

                try {
                    this.sounds[id].sound.stop(0);
                } catch(err) {
                    //log("error", this.class, id, err);
                }// catch

                if(typeof this.sounds[id].playbackState == "undefined") this.sounds[id].playbackState = AudioBufferSourceNode.FINISHED_STATE;
            } catch(err) {
                log("error", err);
            }
        }//for
    };

    this.resumeAll = function() {
        //log("info", this.class,"resumeAll");

        for(var id in this.sounds) {
            this.play(id);
        }//for
    };

    this.add = function(id, url) {
        this.manifest[id] = url;
    };

    this.remove = function(id) {
        try {
            delete this.manifest[id];

            this.stop(id);

            if(typeof this.sounds[id] != "undefined") {
                this.sounds[id].sound = null;
                this.sounds[id].gain = null;
                this.sounds[id].buffer = null;

                delete this.sounds[id];
            }//if
        } catch(err) {
            log("error", err);
        }
    };

    this.load = function(id, sound) {
        try {
            var that = this;
            var request = new XMLHttpRequest();
            
            var url;
            
            if(typeof sound == "string") {
                url = sound;
            }//if
            else if(this.format == "ogg") {
                url = sound.ogg;
            }//else if
            else {
                url = sound.mp3;
            }//else
    	    
            request.open('GET', url, true);
            request.responseType = 'arraybuffer';

            this.sounds[id] = {
                sound: false,
                buffer: false,
                gain: false,
                filter: false,
                loaded: false,
                fadding: false,
                startTime: 0,
                startedAt: false,
                pausedAt: false
            };

            // Decode asynchronously
            request.onload = function() {
                request.buf=request.response;
                request.sync=0;
                request.retry=0;

                that.decode(id, request);
            }
            request.send();
        } catch(err) {
            log("error", err);
        }
    };

    this.play = function(id, throttle, timeOffset, rate, loop, loopStart, loopEnd, volume) {
        
        if(volume == undefined) {
            volume = 1;
        }//if
        
        if(window.globalVolume == undefined) {
            window.globalVolume = 1;
        }//if
        
        var sound, buffer, gain;
        
        try {
            //log("info", id, throttle, timeOffset, rate, loop, loopStart, loopEnd, volume);

            if(typeof this.sounds[id] == "undefined" || !this.sounds[id].loaded || this.sounds[id].fadding) return;
            if(window.globalVolume == 0 && this.sounds[id].sound) return this.stop(id);
            else if(window.globalVolume == 0) return;

            if(this.sounds[id].reversed && rate>0) return this.stop(id);
            if((this.sounds[id].sound && this.sounds[id].sound.playbackState == AudioBufferSourceNode.PLAYING_STATE && !this.sounds[id].reversed)) {
                if(loop) return;
                else this.stop(id);
            }//if
        } catch(err) {
            log("error", err);
        }
        
        try {
            //if(typeof this.sounds[id].sound != "undefined") this.stop(id);

            sound = this.context.createBufferSource();  // creates a sound source
            this.sounds[id].sound = sound;
            this.sounds[id].reversed = false;

            buffer = this.sounds[id].buffer;

            if(rate < 0) {
                buffer = this.cloneAudioBuffer(this.sounds[id].buffer);

                Array.prototype.reverse.call( buffer.getChannelData(0) );
                Array.prototype.reverse.call( buffer.getChannelData(1) );
            }//if

            sound.buffer = buffer;                          // tell the source which sound to play
            //sound.connect(this.context.destination);        // connect the source to the context's destination (the speakers)

            // Create the filter.
            /*this.sounds[id].filter = this.context.createBiquadFilter();
            this.sounds[id].filter.type = 0; // LOWPASS
            this.sounds[id].filter.frequency.value = 5000;
            // Connect source to filter, filter to destination.
            sound.connect(this.sounds[id].filter);
            this.sounds[id].filter.connect(this.context.destination);*/

            if(rate) sound.playbackRate.value = Math.abs(parseFloat(rate));

            if(loop) {
                sound.loop = true;
                sound.loopStart = 0;
                sound.loopEnd = this.sounds[id].buffer.duration;
            }//if

            if(loop && loopStart) sound.loopStart = loopStart;
            if(loop && loopEnd) sound.loopEnd = loopEnd;
        } catch(err) {
            log("error", err);
        }
        
        try {
            //log("info", "play: "+id+", "+throttle+"*"+this.sounds[id].buffer.duration+"+"+timeOffset);

            if (!sound.start)
                sound.start = sound.noteOn;

            if(rate > 0) {
                sound.start(this.context.currentTime, (throttle*this.sounds[id].buffer.duration*rate)+timeOffset);                            // play the source now
            }//if
            else {
                sound.start(this.context.currentTime, (throttle*this.sounds[id].buffer.duration)+timeOffset);                            // play the source now
            }//else
            // note: on older systems, may have to use deprecated noteOn(time);
        } catch(err) {
            log("error", err);
        }

        try {
            // Create a gain node.
            gain = this.context.createGain();

            this.sounds[id].gain = gain;

            // Connect the source to the gain node.
            sound.connect(gain);

            // Connect the gain node to the destination.
            gain.connect(this.context.destination);
        } catch(err) {
            log("error", err);
        }
        
        try {
            if(typeof this.sounds[id].gain.gain != "undefined") this.sounds[id].gain.gain.value = volume*window.globalVolume;
        } catch(err) {
            log("error", err);
        }
        
        try {
            this.sounds[id].startTime = this.context.currentTime;

            this.sounds[id].startedAt = Date.now();
        } catch(err) {
            log("error", err);
        }
        
        try {
            if(typeof this.sounds[id].playbackState == "undefined") this.sounds[id].playbackState = AudioBufferSourceNode.PLAYING_STATE;

            //this.fadeIn(id);
        } catch(err) {
            log("error", err);
        }
    };

    this.reverse = function(id) {
        try {
            if(typeof this.sounds[id] == "undefined" || !this.sounds[id].loaded || !this.sounds[id].sound || this.sounds[id].reversed) return;

            this.sounds[id].reversed = true;

            var buffer = this.cloneAudioBuffer(this.sounds[id].buffer);

            Array.prototype.reverse.call( buffer.getChannelData(0) );
            Array.prototype.reverse.call( buffer.getChannelData(1) );

            this.sounds[id].sound.loop = false;

            this.sounds[id].sound.buffer = buffer;                          // tell the source which sound to play

            this.sounds[id].sound.start(this.context.currentTime, this.sounds[id].sound.loopStart);                            // play the source now
        } catch(err) {
            log("error", err);
        }
    };

    this.rate = function(id, rate) {
        try {
            if(typeof this.sounds[id] == "undefined" || !this.sounds[id].loaded || !this.sounds[id].sound || this.sounds[id].reversed) return;

            if(typeof this.sounds[id].playbackState == "undefined") this.sounds[id].playbackState = AudioBufferSourceNode.PLAYING_STATE;

            //if(this.sounds[id].gain.gain.value < 0.01) rate = 0.01;

            if(rate) this.sounds[id].sound.playbackRate.value = Math.abs(parseFloat(rate));
        } catch(err) {
            log("error", err);
        }
    };

    this.volume = function(id, volume) {
        try {
            if(typeof this.sounds[id] == "undefined" || !this.sounds[id].loaded || !this.sounds[id].sound || this.sounds[id].reversed) return;

            if(typeof this.sounds[id].playbackState == "undefined") this.sounds[id].playbackState = AudioBufferSourceNode.PLAYING_STATE;

            if(typeof this.sounds[id].gain.gain != "undefined") {
                //this.sounds[id].gain.gain.value = Math.max(volume*window.globalVolume, 0.01);
                this.sounds[id].gain.gain.cancelScheduledValues(this.context.currentTime);
                this.sounds[id].gain.gain.setValueAtTime(volume*window.globalVolume, this.context.currentTime);
            }
        } catch(err) {
            log("error", err);
        }
    };

    this.changeFrequency = function(id, frequency) {
        try {
            // Clamp the frequency between the minimum value (40 Hz) and half of the
            // sampling rate.
            var minValue = 40;
            var maxValue = this.context.sampleRate / 2;
            // Logarithm (base 2) to compute how many octaves fall in the range.
            var numberOfOctaves = Math.log(maxValue / minValue) / Math.LN2;
            // Compute a multiplier from 0 to 1 based on an exponential scale.
            var multiplier = Math.pow(2, numberOfOctaves * (frequency - 1.0));
            // Get back to the frequency value between min and max.
            this.sounds[id].filter.frequency.value = maxValue * multiplier;
        } catch(err) {
            log("error", err);
        }
    };

    this.changeQuality = function(id, quality) {
        try {
            this.sounds[id].filter.Q.value = quality * this.QUAL_MUL;
        } catch(err) {
            log("error", err);
        }
    };

    this.stop = function(id) {
        try {
            if(typeof this.sounds[id] == "undefined" || !this.sounds[id].loaded || !this.sounds[id].sound || (this.sounds[id].sound && this.sounds[id].sound.playbackState && this.sounds[id].sound.playbackState == AudioBufferSourceNode.FINISHED_STATE)) return;

            if (!this.sounds[id].sound.stop)
                this.sounds[id].sound.stop = this.sounds[id].sound.noteOff;

            try {
                this.sounds[id].sound.stop(0);

                this.sounds[id].sound = false;
            } catch(err) {
                log("error", err);
            }

            if(typeof this.sounds[id].playbackState == "undefined") this.sounds[id].playbackState = AudioBufferSourceNode.FINISHED_STATE;
            //this.fadeOut(id);
        } catch(err) {
            log("error", err);
        }
    };

    this.fadeOut = function(id) {
        try {
            if(typeof this.sounds[id] == "undefined" || !this.sounds[id].loaded || !this.sounds[id].sound || (this.sounds[id].sound && this.sounds[id].sound.playbackState == AudioBufferSourceNode.FINISHED_STATE)) return;

            var that = this;
            var delay = 500/10;

            var decreaseGain = function(id, value) {
                if(value < 0) {
                    return that.sounds[id].sound.stop();
                }//if

                if(typeof that.sounds[id].gain.gain != "undefined") that.sounds[id].gain.gain.value = value;

                setTimeout(function() {
                    decreaseGain(id, value-0.05);
                },delay);
            };

            if(typeof that.sounds[id].gain.gain != "undefined") decreaseGain(id, that.sounds[id].gain.gain.value);
        } catch(err) {
            log("error", err);
        }
    };

    this.fadeIn = function(id) {
        try {
            if(typeof this.sounds[id] == "undefined" || !this.sounds[id].loaded || !this.sounds[id].sound || (this.sounds[id].sound && this.sounds[id].sound.playbackState == AudioBufferSourceNode.FINISHED_STATE)) return;

            this.sounds[id].fadding = true;

            var that = this;
            var delay = 500/10;

            var increaseGain = function(id, value) {
                if(value > 1) {
                    return that.sounds[id].fadding = false;
                }//if

                if(typeof that.sounds[id].gain.gain != "undefined") that.sounds[id].gain.gain.value = value;

                setTimeout(function() {
                    increaseGain(id, value+0.05);
                },delay);
            };

            increaseGain(id, 0);
        } catch(err) {
            log("error", err);
        }
    };

    this.crossfade = function(id, id2) {
        try {
            var source = this.sounds[id].sound;
            var gainNode = this.sounds[id].gain;
            var duration = this.sounds[id].buffer.duration;

            var currTime = this.context.currentTime;
            // Fade the playNow track in.
            gainNode.gain.linearRampToValueAtTime(0, currTime);
            gainNode.gain.linearRampToValueAtTime(1, currTime + this.FADE_TIME);
            // Play the playNow track.
            source.start(0);

            // At the end of the track, fade it out.
            gainNode.gain.linearRampToValueAtTime(1, currTime + duration-ctx.FADE_TIME);
            gainNode.gain.linearRampToValueAtTime(0, currTime + duration);

            // Schedule a recursive track change with the tracks swapped.
            var recurse = arguments.callee;
            this.timer = setTimeout(function() {
                recurse(id2, id);
            }, (duration - this.FADE_TIME) * 1000);
        } catch(err) {
            log("error", err);
        }
    };
}
