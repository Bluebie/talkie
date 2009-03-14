window.focused = true;

var Messages = {
  // generate the html to display a message
  generate: function(classy, message) {
    if (message.data.body.trim() == '') return;
    
    var messageElement = new Element('div', {'class': 'message'});
    messageElement.store('message-object', message);
    if (message.id) messageElement.set('id', 'message-' + message.id)
    
    if (message.data.from) messageElement.adopt(Users.generateHTML(message.data.from));
    
    var messageBody = new Element('span', {'class': 'body', text: message.data.body});
    messageElement.adopt(messageBody);
    // do smilies
    AutoLink.everything(messageBody);
    smilies.applyToElement(messageBody);
    
    classy.split(' ').each(messageElement.addClass.bind(messageElement));
    
    messageElement.store('message', message);
    var timestamp = new Date();
    if (message.data.timestamp) timestamp.setTime(message.data.timestamp * 1000);
    messageElement.store('timestamp', timestamp);
    messageElement.set('title', 'Sent: ' + timestamp.toString());// + ' ago.');
    
    return messageElement;
  },
  
  // append a new message to the window display
  append: function(classy, message) {
    var messages = $('messages');
    if (messages.getChildren().length > 100) messages.getFirst().destroy();
    var scrolly = messages.getParent().getParent();
    var doScroll = (scrolly.getScroll().y + 15 >= scrolly.getScrollSize().y - scrolly.getSize().y);
    var messageElement = Messages.generate(classy, message);
    messages.adopt(messageElement);
    
    // handle message reordering
    var prevMsg = messages.getLast();
    if (message.id) {
      while (prevMsg && prevMsg.id && prevMsg.id.split('-')[1].toInt() >= message.id) {
        prevMsg = prevMsg.getPrevious();
      }
      if (prevMsg) messageElement.inject(prevMsg, 'after');
    }
    if (doScroll) scrolly.scrollTo(0, scrolly.getScrollSize().y - scrolly.getSize().y);
    
    // update message count in the title bar
    if (!window.focused) {
      window.unreadNum = (window.unreadNum || 0) + 1;
      document.title = '#' + unreadNum + ' messages — ' + window.oldTitle;
      if (window.fluid) window.fluid.dockBadge = unreadNum;
    }
    
    return messageElement;
  }
};




// A simple Long Polling comet json stream reciever.
// Usage: var stream = new StreamConnection('/stream', {room: window.room, multipart: 'no', identity: window.openid}).start();
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
    this.streamAjax.xhr.onabort = this.onFailure;
    this.streamAjax.xhr.onerror = this.onFailure;
  },
  
  onSuccess: function(text) {
    var messages = text.split(/\n/).map(function(msg) { return JSON.decode(msg, true) });
    messages.erase(null);
    this.parent(messages);
  },
  
  _start: function() { this.streamAjax.send({url: this.source, data: this.streamParams}); },
  
  _stop: function() { this.streamAjax.cancel(); }
});

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


var highlightClassMaybe = function(message) {
  if (message.data.from != window.openid
   && message.data.body.test('(^|[^a-z0-9])' + Users.lookup(window.openid).name.escapeRegExp() + '($|[^a-z0-9])', 'i')
   && stream.initialLoadDone) {
    if (window.fluid) {
      var sender = Users.lookup(message.data.from);
      //window.fluid.playSoundNamed('Submarine');
      window.fluid.showGrowlNotification({
        title: sender.name + ' mentioned your name',
        description: message.data.body,
        priority: 1,
        sticky: false,
        identifier: 'Name Highlighted',
        icon: sender.userDir + '/avatar-80.png?' + sender.updated
      });
    }
    var tink = $('tink');
    if (tink && tink.pause && tink.play) {
      tink.volume = 0.8;
      tink.pause();
      tink.currentTime = 0.0;
      tink.play()
    }
    return ' highlight';
  } else {
    return '';
  }
}

// mimetype handlers which process incoming messages
var MessageHandlers = {
  'text/plain': function(message) {
    Messages.append('normal' + highlightClassMaybe(message), message);
  },
  'text/x-talkie-action': function(message) {
    Messages.append('action' + highlightClassMaybe(message), message);
  },
  'text/x-debug': function(message) {
    //Messages.append('system debug', message);
    if (!stream.initialLoadDone) return;
    if (window.console) {
      console.log(Users.lookup(message.data.from).name + ': ');
      console.log(message.data.body);
    }
  },
  'application/x-talkie-user-enters': function(message) {
    if (stream.initialLoadDone && Users.active.contains(message.data.from)) return;
    Users.active.push(message.data.from);
    Messages.append('system enters', message);
    Users.refreshList();
  },
  'application/x-talkie-user-leaves': function(message) {
    if (stream.initialLoadDone && !Users.active.contains(message.data.from)) return;
    Users.active.erase(message.data.from)
    Messages.append('system leaves', message);
    Users.refreshList();
  },
  'application/x-talkie-go-home': function(message) {
    Messages.append('system deleted', message);
    (function() { window.location.href = "../../home"; }).delay(5000);
  },
  'application/x-talkie-reload': function(message) {
    if (stream.initialLoadDone) window.location.href = 'chat';
  },
  'application/x-talkie-user-info': function(message) {
    message.data.body.each(Users.loadProfile);
  },
  'application/x-talkie-active-users': function(message) {
    Users.active = message.data.body;
    Users.refreshList();
    
    if (Users.lookup(window.openid)['name'] == 'Anonymous') {
      Messages.append('local error anonName', {data: {
        'type': 'text/x-talkie-local-error',
        'body': 'Your name is currently set to “Anonymous”, to change this, press the Leave button above, and enter a name in the text box at the top of that page. You can also upload an avatar and provide a little profile description while there. When done, return to the room by selecting it in the list on that page, or with the Back button in your browser. :)'
      }});
    }
  },
  'application/x-talkie-room-cleared': function(message) {
    $('messages').empty();
    Messages.append('system cleared', message);
  }
}


window.addEvent('domready', function() {
  //window.stream = new JSONStream(window.streamEndpoint || '/stream', {room: window.room, mode: 'lines', identity: window.openid});
  window.stream = new XHRStream('/stream', {room: window.room, mode: 'lines', identity: window.openid});
  
  window.stream.addEvent('message', function(message) {
    if (message.id && message.id > (this.streamParams.last || 0)) this.streamParams.last = message.id
    if ($('message-' + message.id)) return;
    MessageHandlers[message.data.type].run(message, this);
  });
  
  window.stream.addEvent('streamlost', function() {
    Messages.append('local error', {data: {
      'type': 'text/x-talkie-local-error',
      'body': 'Excuse us a moment, our tubes are obstructed, our servers went splat, though we’ll surely be back. Hold tight, this client will fight a good fight.'
    }});
  });
  window.stream.addEvent('streamrestored', function() {
    Messages.append('local error', {data: {
      'type': 'text/x-talkie-local-error',
      'body': 'All Clear, there were no fatalities. Resume your debate on the meaning of life. :)'
    }});
  });
  
  if (settings.background && settings.background.enabled) {
    var spacer = $(document.html);
    if (settings.background.url.toString().length > 0) spacer.setStyle('background-image', 'url("'+settings.background.url+'")');
    spacer.setStyle('background-color', settings.background.colour);
    spacer.setStyle('background-repeat', settings.background.repeat ? 'repeat' : 'no-repeat');
    spacer.setStyle('background-position', 'center center');
  }
  
  window.oldTitle = document.title;
  
  
  // handles the sending of messages
  window.sendMessage = function () {
    var text = $('message').get('value').trim();
    var mimetype = 'text/plain';
    if (text == '') return;
    
    // support actions
    var actionTest = /^(;|:|\/me )/;
    var startSmile = (window.smilies)?smilies.sensor.exec(text):false;
    if (startSmile) startSmile = (startSmile.index == 0);
    if (text.test(actionTest) && !startSmile) {
      mimetype = 'text/x-talkie-action';
      text = text.replace(actionTest, '');
    }
    
    var messageObject = {body: text, type: mimetype, timestamp: (new Date()).getTime() / 1000, from: window.openid};
    var msgJson = JSON.encode(messageObject);
    var msgID = 0 - (stream.streamParams.last || 1);
    var messageElement = Messages.append(mimetype == 'text/plain' ? 'normal' : 'action', {data: messageObject});
    messageElement.set('tween', {duration: 2000, transition: Fx.Transitions.Sine.easeOut});
    messageElement.set('opacity', 0.33);
    messageElement.fade(0.77);
    
    var failure = function(message) {
      stream.onFailure();
      message = message || 'Due to a network error, your message “' + text + '” was not sent.';
      messageElement = Messages.generate('local error', {data: {
        'type': 'text/x-talkie-local-error',
        'timestamp': (new Date()).getTime(),
        'body': message.toString()
      }}).replaces(messageElement);
      //if (window.watchdog) window.watchdog();
      var scrolly = $('messages').getParent().getParent();
      scrolly.scrollTo(0, scrolly.getScrollSize().y - scrolly.getSize().y);
    }
    
    var success = function(messageText) {
      var result = JSON.decode(messageText);
      if (!result.success) return failure(result.error);
      $$('#message-' + result.id).destroy();
      var newMsg = Messages.generate(mimetype == 'text/plain' ? 'normal' : 'action', result);
      newMsg.set('tween', {duration: 100, transition: Fx.Transitions.Sine.easeIn});
      newMsg.set('opacity', messageElement.get('opacity'));
      newMsg.fade('in');
      newMsg.replaces(messageElement);
      //if (prevMsg) messageElement.inject(prevMsg, 'after');
      if (window.watchdog) window.watchdog();
    }
    
    var req = new Request({ url: '/rooms/' + room + '/send', link: 'chain', onFailure: function() { failure(); }, onSuccess: success})
    req.xhr.onerror = function() { req.failure(); };
    req.send({data: {message: msgJson}});
    $('message').set('value', '').focus();
  }
  
  $('sendMessage').addEvent('click', sendMessage);
  $('message').addEvent('keypress', function(event) {
    if (event.key == 'enter') sendMessage();
  });
  
  $('message').focus();
  
  var tabCompleteDebounce; var tabCompleter = function() {
    var msg = $('message');
    var carrot = msg.selectionStart; // delicious
    var piece = msg.get('value').substring(0, carrot);
    var piece = piece.match(/(.*?)([a-z0-9]+)$/i);
    if (piece == null || piece[2].length == 0) { msg.focus(); return; }
    var sensor = new RegExp('^' + piece[2].escapeRegExp(), 'i');
    var replacer = new RegExp('^' + piece[1] + piece[2].escapeRegExp());
    
    var done = false;
    Users.active.each(function(user) {
      if (done == true) return;
      user = Users.profiles[user];
      if (user.name.match(sensor)) {
        var replaceWith = user.name + (piece[1].length > 0 ? ' ' : ': ');
        msg.value = msg.value.substring(0, msg.selectionStart - piece[2].length) + replaceWith + msg.value.substring(msg.selectionEnd, msg.value.length);
        //msg.selectionStart = piece[0].length;
        msg.selectionStart = msg.selectionEnd = piece[0].length + (replaceWith.length - piece[2].length);
        done = true;
      }
    });
    var selection = [msg.selectionStart, msg.selectionEnd];
    msg.focus();
    msg.selectionStart = selection[0];
    msg.selectionEnd = selection[1];
  }
  
  
  var tabSense = new Element('input', {
    'type': 'text',
    'id': 'tabSense',
    'styles': {
      'position': 'absolute',
      'left': '-99999px'
    },
    'events': {
      focus: function() { $clear(tabCompleteDebounce); tabCompleter.delay(50); }
    }
  });
  
  tabSense.inject('message', 'after');
  
  
  
  
  // keep the tooltips up to date
/*
  window.toolUpdator = (function() {
    $$('#messages .message').each(function(i) {
      var timestamp = i.retrieve('timestamp');
      if (timestamp) i.set('title', 'Sent ' + timestamp.relativeTime() + ' ago.');
    });
  }).periodical(60000);
*/
  
  // work around firefox braindeadly killing the stream then letting javascript reconnect it.
  window.addEvents({'beforeunload': stream.stop, 'unload': stream.stop});
  $('leave').addEvent('click', stream.stop);
  
  
  // set up the smilies selector
  var selector = $('smiliesSelector').getFirst();
  Hash.each(smilies.data, function(triggers, url) {
    selector.adopt(new Element('img', {
      'class': 'smilie',
      'src': url,
      'alt': triggers[0],
      'title': triggers[0],
      events: {
        click: function() { $('message').insertAtCursor(triggers[0]); }
      }
    }));
  });
  
  
  // redirect stray keypresses in to the message field
  if (Browser.Platform != 'ipod') window.addEvent('keypress', function(event) {
    if (event.key == 'esc') {
      if (event.shift) {
        window.location.href = '../../logout';
      } else {
        window.location.href = $('leave').href;
      }
    }
    
    if (event.control || event.meta) return;
    if (event.key.length > 1) return;
    if (event.target.id != 'message') {
      var key = event.shift ? event.key.toUpperCase() : event.key;
      $('message').insertAtCursor(key);
    }
  });
  
  // add the audio element for highlight alert sound
  document.body.adopt(new Element('audio', { id: 'tink', src: "../../sounds/zither.mp3", autobuffer: true }));
});


window.addEvent('load', function() {
  window.stream.start();
  
  /*window.watchdogTimeout = 55; // seconds
  window.watchdog = function() {
    var now = new Date();
    if (stream.lastLoadTimestamp == null || stream.lastLoadTimestamp.getTime() < (now.getTime() - (window.watchdogTimeout * 1000))) {
      stream.stop();
      stream.start();
    }
  }
  
  window.watchdogTimer = watchdog.periodical(2500);
  window.addEvents('focus', watchdog);*/
});


window.addEvent('focus', function() {
  window.focused = true;
  document.title = window.oldTitle;
  if (window.fluid) window.fluid.dockBadge = null;
  $('message').focus();
});

window.addEvent('blur', function() {
  window.unreadNum = 0;
  window.focused = false;
});
