// A simple Long Polling comet json stream reciever.
// Usage: var stream = new XHRConnection('/stream', {rooms: window.room, identity: window.openid}).start();
var StreamConnection = new Class({
  Implements: [Events],
  Binds: ['onSuccess', 'onFailure', 'stop'],
  
  streamParams: {},
  initialLoadDone: false,
  options: {},
  lastLoadTimestamp: null,
  
  initialize: function(stream, params) {
    this.source = stream;
    this.streamParams = params;
    this.streamParams.poll = 'long';
  },
  
  // start the stream connection
  start: function(aliver) {
    this.alive = $defined(aliver) ? aliver : true;
    this.streamParams.noCache = (Math.random() * 1000000).toInt();
    this.lastLoadTimestamp = new Date();
    this._start();
    return this;
  },
  
  // disconnect the stream
  stop: function() {
    this.alive = false;
    $clear(this.restartTimer);
    this._stop();
  },
  
  onSuccess: function(obj) {
    $clear(this.restartTimer);
    this.streamParams.poll = 'long';
    
    if (!this.alive) {
      this.alive = true;
      this.fireEvent('streamrestored');
    }
    
    obj.each(function(msg) {
      this.fireEvent('message', msg);
    }.bind(this));
    
    // we have a longer delay after joining to get browsers to display the page as done loading
    this.restartTimer = this.start.delay(this.initialLoadDone ? 50 : 555, this);
    this.initialLoadDone = true;
  },
  
  onFailure: function() {
    this.streamParams.poll = 'instant';
    $clear(this.restartTimer);
    this.restartTimer = this.start.periodical(2500, this, [false]);
    
    if (this.alive) {
      this.alive = false;
      this.fireEvent('streamlost');
    }
  }
});

// Connects to a stream using an XMLHTTPRequest object. Dependable and reliable, but be aware of the browsers
// typical two connection per domain limiter, and XHR's inability to cross domains. Use only one of these, or
// you will have no connections left to load images and send notices to the server over.
// Firefox and IE8 have raised this limit to 8 as a temporary measure.
var XHRStream = new Class({
  Extends: StreamConnection,
  
  initialize: function(endpoint, params) {
    this.parent(endpoint, params);
    this.streamParams.mode = 'lines';
    this.streamAjax = new Request({
      method: 'get', link: 'cancel',
      onSuccess: this.onSuccess.bind(this),
      onFailure: this.onFailure.bind(this),
      headers: {}
    });
    
    // work around mootools bug where 'failure' doesn't fire on network errors
    this.streamAjax.xhr.onabort = this.onFailure.bind(this);
    this.streamAjax.xhr.onerror = this.onFailure.bind(this);
  },
  
  onSuccess: function(text) {
    var messages = text.split(/\n/).map(function(msg) { return JSON.decode(msg, true) });
    messages.erase(null);
    this.parent(messages);
  },
  
  _start: function() { this.streamAjax.send({url: this.source, data: this.streamParams}); },
  
  _stop: function() { this.streamAjax.cancel(); }
});

// makes connection to a stream using JSON-P, which free's you of cross domain problems, but creates the problem of bad error handling
// NOTE: This is still buggy, not recommended for real world use yet.
var JSONStream = new Class({
  Extends: StreamConnection,
  Binds: ['onSuccess'],
  
  initialize: function(endpoint, params) {
    this.parent(endpoint, params);
    this.streamParams.mode = 'array'
    
    this.uniqID = 'req_' + (Math.random() * 1000000).toInt().toString(36);
    JSONStream.requests = JSONStream.requests || {};
    JSONStream.requests[this.uniqID] = this;
  },
  
  getURL: function() {
    return this.source + '?' + Hash.toQueryString(this.streamParams);
  },
  
  onSuccess: function(obj) {
    $clear(this.timeout);
    this.lastLoadTimestamp = new Date();
    this.parent(obj);
  },
  
  _stop: function() {
    this.workerTag.dispose();
  },
  
  _start: function() {
    this.streamParams.callback = 'JSONStream.requests.' + this.uniqID + '.onSuccess';
    if (this.workerTag) this._stop();
    this.workerTag = new Element('script', {'type': 'application/javascript', 'src': this.getURL(), 'class': 'JSONStream'});
    document.head.adopt(this.workerTag);
    
    $clear(this.timeout);
    this.timeout = this.onFailure.delay(55000);
  }
});