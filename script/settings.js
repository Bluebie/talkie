window.addEvent('domready', function () {
  $('uploadAvatar').addEvent('click', function() {
    uploadWindow('room', {room: window.room, formats: 'any image, though jpeg, png, gif are safest', maxSize: 5000000}, function(dom) {
      (new Element('img', {src: urlroot + '/rooms/' + room + '/avatar-80.png?' + (Math.random() * 10000).toInt(), id: 'roomAvImg'})).replaces('roomAvImg');
    });
  });
  
  // remove avatar thingy
  $('removeAvatar').addEvent('click', function() {
    (new Request({
      url: '/alter-avatar/room/remove', link: 'cancel', data: {room: room},
      onSuccess: function() {
        (new Element('img', {src: '/default/room/avatar-80.png', id: 'roomAvImg'})).replaces('roomAvImg');
      }
    })).send();
  });
  
  // do the gag list
  var gagged = $('gagged').get('value').split("\n");
  gagged.erase('');
  var gagger = function(openid) {
    if (!gagged.contains(openid)) gagged.push(openid);
    $('gagged').set('value', gagged.join("\n"));
    var gag = new Element('div', {text: openid + ' '});
    gag.adopt(new Element('a', {text: 'remove', href: '#', events: {click: function() {
      gagged.erase(openid);
      $('gagged').set('value', gagged.join("\n"));
      gag.dispose();
      return false;
    }}}));
    $('list_of_gagged').adopt(gag);
  }
  gagged.each(gagger);
  
  $('add_gag_btn').addEvent('click', function() {
    gagger($('add_gag').get('value'));
    $('add_gag').set('value', '');
  })
});

window.addEvent("load", function() { $("title").focus(); });
