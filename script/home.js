window.addEvent('domready', function () {
  
  var propStoreJax = new Request({url: 'merge-profile', link: 'cancel'});
  function storeProfileProp(prop) {
    propStoreJax.send({data: {'prop': $(prop).id, 'value': $(prop).value}});
  }
  
  // make edits to the user profile autosave
  [$('name'), $('desc')].each(function(input) {
    var timer;
    input.addEvent('keyup', function() {
      $clear(timer);
      timer = storeProfileProp.delay(1000, null, [input.id]);
    });
  });
  
  window.userPicSwiff = new Swiff.Uploader({
    multiple: false, queued: false, fieldName: 'upload', url: '/alter-avatar/user/upload', target: 'uploadAvatar',
    data: {'camping_blob': Cookie.read('camping_blob'), 'camping_hash': Cookie.read('camping_hash')},
    typeFilter: {'Web Images (*.png, *.jpeg, *.gif)': '*.jpg;*.jpeg;*.png;*.gif'},
    path: '/script/swiff.uploader.swf'
  });
  
  // stupidness for Flash 10
  /*
  userPicSwiff.toElement().setStyle('display', 'none');
  $$('#userAv .menu')[0].addEvents({
    menuhidden: function() { userPicSwiff.toElement().getParent().setStyle('display', 'none'); },
    menushown: function() { userPicSwiff.toElement().getParent().setStyle('display', ''); }
  });
*/
  
  // TODO add logic for uploading
  $('uploadAvatar').addEvent('click', function() {
    setPie($$('#userAv .pie')[0], 0);
    userPicSwiff.browse();
  });
  
  userPicSwiff.addEvent('select', function(file) { userPicSwiff.upload(); });

  userPicSwiff.addEvent('progress', function(file, current, overall) {
    $('userAvImg').setStyle('visibility', 'hidden');
    setPie($$('#userAv .pie')[0], current.bytesLoaded / current.bytesTotal);
  });
  
  userPicSwiff.addEvent('complete', function(file, response) {
    (new Element('img', {src: userDir+'/avatar-80.png?'+(Math.random() * 10000).toInt(), id: 'userAvImg'})).replaces('userAvImg');
  });
  
  // remove avatar thingy
  $('removeAvatar').addEvent('click', function() {
    (new Request({
      url: '/alter-avatar/user/remove', link: 'cancel',
      onSuccess: function() {
        (new Element('img', {src: '/style/default-avatar-80.png', id: 'userAvImg'})).replaces('userAvImg');
      }
    })).send();
  });
});
