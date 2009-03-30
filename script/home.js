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
  
  $('uploadAvatar').addEvent('click', function() {
    alert("Not implemented yet. Upload a 'pavatar' to your website and use it as an openid as a work around for now. :)");
    // TODO: Open some kind of popup to upload picture with
  });
  
  /*userPicSwiff.addEvent('complete', function(file, response) {
    (new Element('img', {src: userDir+'/avatar-80.png?'+(Math.random() * 10000).toInt(), id: 'userAvImg'})).replaces('userAvImg');
  });*/
  
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
