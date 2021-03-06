window.focused = true;

var Messages = {
  // generate the html to display a message
  generate: function(classy, message) {
    if (message.body.toString().trim() == '') return;
    
    var messageElement = new Element('div', {'class': 'message'});
    messageElement.store('message-object', message);
    if (message.id) messageElement.set('id', 'message-' + message.id);
    
    if (message.from) messageElement.adopt(
      Users.generateHTML(message.from).adopt(new Element('span', {'class': 'invisiText', text: ': '}))
    );
    
    var messageBody = new Element('span', {'class': 'body'});
    if ($type(message.body) == 'string') {
      messageBody.set('text', message.body);
    } else {
      if (message.type == 'application/x-talkie-file')
        messageBody.appendText("uploaded a file: ").adopt(
          new Element('a', {href: 'message-'+message.id+'-file.'+message.body.extension, target: '_blank', text: message.body.filename, type: message.body.type})
        ).appendText('.');
    }
    messageElement.adopt(messageBody);
    // do smilies
    AutoLink.everything(messageBody);
    smilies.applyToElement(messageBody);
    
    classy.split(' ').each(messageElement.addClass.bind(messageElement));
    
    messageElement.store('message', message);
    var timestamp = new Date();
    if (message.timestamp) timestamp.setTime(message.timestamp * 1000);
    messageElement.store('timestamp', timestamp);
    messageElement.set('title', 'Sent: ' + timestamp.toLocaleString());// + ' ago.');
    
    return messageElement;
  },
  
  // append a new message to the window display
  append: function(classy, message) {
    var messages = $('messages');
    if (messages.getChildren().length > 100) messages.getFirst().destroy();
    var scrolly = messages.getParent().getParent();
    var doScroll = (scrolly.getScroll().y + 15 >= scrolly.getScrollSize().y - scrolly.getSize().y);
    var messageElement = Messages.generate(classy, message);
    //messages.adopt(messageElement);
    
    // handle message reordering
    var prevMsg = messages.getLast();
    if (message.id) {
      while (prevMsg && prevMsg.id && prevMsg.id.split('-')[1].toInt() >= message.id) {
        prevMsg = prevMsg.getPrevious();
      }
      if (prevMsg) messageElement.inject(prevMsg, 'after');
    }
    if (!messages.getChildren().contains(messageElement)) messages.adopt(messageElement);
    if (doScroll) scrolly.scrollTo(0, scrolly.getScrollSize().y - scrolly.getSize().y);
    
    // update message count in the title bar
    if (window.stream && window.stream.initialLoadDone && message.from != window.openid) {
      window.unreadNum = (window.unreadNum || 0) + 1;
      document.title = '#' + unreadNum + ' messages — ' + window.oldTitle;
      if (window.fluid) window.fluid.dockBadge = unreadNum;
    }
    
    return messageElement;
  }
};


var highlightClassMaybe = function(message) {
  if (message.from != window.openid
   && message.body.test('(^|[^a-z0-9])' + Users.lookup(window.openid).name.escapeRegExp() + '($|[^a-z0-9])', 'i')
   && stream.initialLoadDone) {
    if (window.fluid) {
      var sender = Users.lookup(message.from);
      //window.fluid.playSoundNamed('Submarine');
      window.fluid.showGrowlNotification({
        title: sender.name + ' mentioned your name',
        description: message.body,
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
  'application/x-talkie-file': function(message) {
    Messages.append('action file-shared', message);
  },
  'application/x-talkie-user-enters': function(message) {
    if (stream.initialLoadDone) {
      Users.active.push(message.from);
      Users.refreshList();
    }
    Messages.append('system enters', message);
  },
  'application/x-talkie-user-leaves': function(message) {
    if (stream.initialLoadDone) {
      Users.active.erase(message.from);
      Users.refreshList();
    }
    
    Messages.append('system leaves', message);
  },
  'application/x-talkie-go-home': function(message) {
    Messages.append('system deleted', message);
    (function() { window.location.href = "../../home"; }).delay(5000);
  },
  'application/x-talkie-reload': function(message) {
    if (stream.initialLoadDone) window.location.href = 'chat';
  },
  'application/x-talkie-user-info': function(message) {
    message.body.each(Users.loadProfile);
  },
  'application/x-talkie-active-users': function(message) {
    Users.active = message.body;
    Users.refreshList();
    
    if (Users.lookup(window.openid)['name'] == 'Anonymous') {
      Messages.append('local error anonName', {
        'type': 'text/x-talkie-local-error',
        'body': 'Your name is currently set to “Anonymous”, to change this, press the Leave button above, and enter a name in the text box at the top of that page. You can also upload an avatar and provide a little profile description while there. When done, return to the room by selecting it in the list on that page, or with the Back button in your browser. :)'
      });
    }
  },
  'application/x-talkie-room-cleared': function(message) {
    $('messages').empty();
    Messages.append('system cleared', message);
  }
}


window.addEvent('domready', function() {
  
  //// set the title
  document.title = settings.title + ' — ' + document.title;
  
  //// Build the page
  var container;
  document.body.adopt(UI.container(null, null, [
    // the bar up top
    UI.bar('top').adopt(
      UI.centered().adopt( UI.title(window.settings.title) ),
      UI.lefted().adopt( UI.button('Leave', 'left', { href: 'leave', id: 'leave' }) ),
      UI.righted().adopt(
        UI.button(new Element('span', {text: 'Mute', id: 'muteText'}), 'square', { id: 'muteButton' }),
        UI.button('Settings', 'square', { href: 'setup', id: 'settingsButton' })
      )
    ),
    
    UI.scrolly(true).adopt(
      (new Element('div', {'class': 'wrap'})).adopt(
        new Element('div', {'id': 'messages'}),
        UI.sidebar().adopt(
          UI.sidebarBoxy({'id': 'userlist'}),
          UI.sidebarBoxy({'id': 'sendfileboxy'}, [ UI.button(null, null, {id: 'sendFileButton'}).adopt( new Element('b', {text: 'Send Creation'}) ) ])
        )
      )
    ),
    
    (new Element('form', {'class': 'inputBox', events: {submit: function() { window.sendMessage(); return false; }}})).adopt(
      new Element('input', {'id': 'message', 'type': 'text', 'maxlength': '2500', 'autocomplete': 'off'}),
      (new Element('div', {'id': 'smilies'})).adopt(
        new Element('div', {'id': 'smiliesSelector', 'class': 'menu'}).adopt(
          new Element('div', {'class': 'body'}),
          new Element('div', {'class': 'footer'})
        )
      ),
      UI.button('Send', 'square', {'id': 'sendMessage'})
    )
  ]));
  
  // only display the settings button to people who can actually use it
  $('settingsButton').setStyle('display', settings.owners.contains(window.openid) ? '' : 'none');
  
  // set up the mute button and tink sound
  if (window.Audio) {
    document.body.adopt(new Element('audio', { id: 'tink', src: "../../sounds/zither.mp3", autobuffer: true }));
    var updateMuter = function() { $('muteText').set('text', $('tink').muted ? 'Unmute' : 'Mute'); }
    $('muteButton').addEvent('click', function() { $('tink').muted = !$('tink').muted; updateMuter(); });
    updateMuter();
    $('tink').volume = 0.8;
  } else {
    $('muteButton').destroy();
  }
  
  // set up the smilies menu
  menuify('smiliesSelector');
  // set up the event handler for sending files
  $('sendFileButton').addEvent('click', function() {
    var msg = "You can use the Send Creation button to upload one of your creative works to this room. Select a file using the file chooser below this text, and then use the button below that to send it. Depending on the size and speed of your connection, the file will upload in some time. Once it’s done, this popup will close itself. Please though, only upload content you yourself created or helped to create, or you were featured within. Nothing pornographic or offensive either please. If you must, make sure you warn people in the room before you send such things. No more than 5mb’s either… for now.";
    uploadWindow(urlroot + '/rooms/' + room + '/send', {formats: 'Any format', maxSize: 5000000, message: msg});
  });
  
  // this aint ready for the public to use, server side stuff is missing, so lets hide it!
  //$('sendfileboxy').setStyle('display', 'none');
  
  UI.finish();
  
  
  
  //window.stream = new JSONStream(window.streamEndpoint || '/stream', {room: window.room, mode: 'lines', identity: window.openid});
  window.stream = new XHRStream('/stream', {rooms: window.room, positions: 'null', mode: 'lines', identity: window.openid});
  
  window.stream.addEvent('message', function(message) {
    if (message.id && message.id > (this.streamParams.positions == 'null' ? 0 : this.streamParams.positions)) this.streamParams.positions = message.id;
    if ($('message-' + message.id)) return;
    (MessageHandlers[message.type] || $empty).run(message, this);
  });
  
  window.stream.addEvent('streamlost', function() {
    Messages.append('local error', {
      'type': 'text/x-talkie-local-error',
      'body': 'Excuse us a moment, our tubes are obstructed, our servers went splat, though we’ll surely be back. Hold tight, this client will fight a good fight.'
    });
  });
  window.stream.addEvent('streamrestored', function() {
    Messages.append('local error', {
      'type': 'text/x-talkie-local-error',
      'body': 'All Clear, there were no fatalities. Resume your debate on the meaning of life. :)'
    });
  });
  
  
  window.oldTitle = document.title;
  
  
  // handles the sending of messages
  window.sendMessage = function () {
    var text = $('message').get('value').trim();
    var mimetype = 'text/plain';
    if (text == '') return;
    
    // support actions
    var actionTest = /^(; |: |\/me )/;
    if (text.test(actionTest)) {
      mimetype = 'text/x-talkie-action';
      text = text.replace(actionTest, '');
    }
    
    var messageObject = {body: text, type: mimetype, timestamp: (new Date()).getTime() / 1000, from: window.openid};
    var msgJson = JSON.encode(messageObject);
    var msgID = 0 - (stream.streamParams.last || 1);
    var messageElement = Messages.append(mimetype == 'text/plain' ? 'normal' : 'action', messageObject);
    messageElement.set('tween', {duration: 2000, transition: Fx.Transitions.Sine.easeOut});
    messageElement.set('opacity', 0.33);
    messageElement.fade(0.77);
    
    var failure = function(message) {
      stream.onFailure();
      message = message || 'Due to a network error, your message “' + text + '” was not sent.';
      messageElement = Messages.generate('local error', {
        'type': 'text/x-talkie-local-error',
        'timestamp': (new Date()).getTime(),
        'body': message.toString()
      }).replaces(messageElement);
      //if (window.watchdog) window.watchdog();
      var scrolly = $('messages').getParent().getParent();
      scrolly.scrollTo(0, scrolly.getScrollSize().y - scrolly.getSize().y);
    }
    
    var success = function(messageText) {
      var result = JSON.decode(messageText);
      if (!result.success) return failure(result.error);
      var newMsg = $('message-' + result.id) || Messages.generate(mimetype == 'text/plain' ? 'normal' : 'action', result);
      newMsg.set('tween', {duration: 100, transition: Fx.Transitions.Sine.easeIn});
      newMsg.set('opacity', messageElement.get('opacity'));
      newMsg.fade('in');
      newMsg.replaces(messageElement);
      //if (prevMsg) messageElement.inject(prevMsg, 'after');
      if (window.watchdog) window.watchdog();
    }
    
    var req = new Request({ url: '/rooms/' + room + '/send', link: 'chain', onFailure: function() { failure(); }, onSuccess: success});
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
  
  
  // work around firefox braindeadly killing the stream then letting javascript reconnect it.
  window.addEvents({'beforeunload': stream.stop.bind(stream), 'unload': stream.stop.bind(stream)});
  $('leave').addEvent('click', stream.stop.bind(stream));
  
  
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
  
});


window.addEvent('load', function() {
  window.stream.start.delay(50, window.stream);
  
  if (settings.background && settings.background.enabled) {
    var spacer = $(document.html);
    if (settings.background.url.toString().length > 0) spacer.setStyle('background-image', 'url("'+settings.background.url+'")');
    spacer.setStyle('background-color', settings.background.colour);
    spacer.setStyle('background-repeat', settings.background.repeat ? 'repeat' : 'no-repeat');
    spacer.setStyle('background-position', 'center center');
  }
  
  window.watchdogTimeout = 60; // seconds
  window.watchdog = function() {
    var now = new Date();
    if (stream.lastLoadTimestamp == null || stream.lastLoadTimestamp.getTime() < (now.getTime() - (window.watchdogTimeout * 1000))) {
      stream.stop();
      stream.start();
    }
  }
  
  window.watchdogTimer = watchdog.periodical(2500);
  window.addEvents('focus', watchdog);
});


focused = function() {
/*   window.focused = true; */
  if (document.title != window.oldTitle) document.title = window.oldTitle;
  window.unreadNum = 0;
  if (window.fluid) window.fluid.dockBadge = null;
  $('message').focus();
};

$(document).addEvent('mousemove', focused);
$(document).addEvent('keydown', focused);
$(document).addEvent('focus', focused);
$(window).addEvent('mousemove', focused);
$(window).addEvent('keydown', focused);
$(window).addEvent('focus', focused);

/*
window.addEvent('blur', function() {
  window.unreadNum = 0;
  window.focused = false;
});
*/
