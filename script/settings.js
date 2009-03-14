window.addEvent('domready', function () {
  window.roomPicSwiff = new Swiff.Uploader({
    multiple: false, queued: false, fieldName: 'upload', url: '/alter-avatar/room/upload', target: 'uploadAvatar',
    data: {'camping_blob': Cookie.read('camping_blob'), 'camping_hash': Cookie.read('camping_hash'), 'room': window.room },
    typeFilter: {'Web Images (*.png, *.jpeg, *.gif)': '*.jpg;*.jpeg;*.png;*.gif'},
    path: '/script/swiff.uploader.swf'
  });
  
  // stupidness for Flash 10
  /*
  roomPicSwiff.toElement().setStyle('display', 'none');
  $$('#roomAv .menu')[0].addEvents({
    menuhidden: function() { roomPicSwiff.toElement().getParent().setStyle('display', 'none'); },
    menushown: function() { roomPicSwiff.toElement().getParent().setStyle('display', ''); }
  });
*/
  
  // TODO add logic for uploading
  $('uploadAvatar').addEvent('click', function() {
    setPie($$('#roomAv .pie')[0], 0);
    roomPicSwiff.browse();
  });
  
  roomPicSwiff.addEvent('select', function(file) { roomPicSwiff.upload(); });

  roomPicSwiff.addEvent('progress', function(file, current, overall) {
    $('roomAvImg').setStyle('visibility', 'hidden');
    setPie($$('#roomAv .pie')[0], current.bytesLoaded / current.bytesTotal);
  });
  
  roomPicSwiff.addEvent('complete', function(file, response) {
    (new Element('img', {src: '/rooms/' + room + '/avatar-80.png?'+(Math.random() * 10000).toInt(), id: 'roomAvImg'})).replaces('roomAvImg');
  });
  
  // remove avatar thingy
  $('removeAvatar').addEvent('click', function() {
    (new Request({
      url: '/alter-avatar/room/remove', link: 'cancel', data: {'room': room},
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
